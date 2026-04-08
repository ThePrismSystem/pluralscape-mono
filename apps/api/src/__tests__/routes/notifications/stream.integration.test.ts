/**
 * Integration tests for GET /notifications/stream (SSE endpoint).
 *
 * Uses a real @hono/node-server HTTP listener so that fetch + AbortController
 * can trigger genuine client-side disconnects and exercise the finally-block
 * cleanup paths that cannot be reached through Hono's in-memory app.request().
 */
import { serve } from "@hono/node-server";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { mockAuthFactory, mockRateLimitFactory } from "../../helpers/common-route-mocks.js";
import { createRouteApp, MOCK_AUTH } from "../../helpers/route-test-setup.js";

import type { Server } from "node:http";

// ── Pub/Sub mock ─────────────────────────────────────────────────────────────

type PubSubHandler = (message: string) => void;
let capturedHandler: PubSubHandler | null = null;

function createMockPubSub() {
  return {
    subscribe: vi.fn((_channel: string, handler: PubSubHandler) => {
      capturedHandler = handler;
      return Promise.resolve("subscribed" as const);
    }),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
  };
}

type MockPubSub = ReturnType<typeof createMockPubSub>;
let mockPubSub: MockPubSub | undefined;

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("../../../middleware/auth.js", () => mockAuthFactory());
vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());
vi.mock("../../../lib/notification-pubsub.js", () => ({
  getNotificationPubSub: vi.fn(() => mockPubSub),
}));
vi.mock("../../../lib/logger.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../lib/logger.js")>();
  return {
    ...actual,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  };
});

// ── Module imports after mocks ───────────────────────────────────────────────

const { notificationsRoutes, _resetSseStateForTesting, _addMockStreamForTesting } =
  await import("../../../routes/notifications/stream.js");

// ── Server lifecycle ─────────────────────────────────────────────────────────

const TEST_PORT = 19847;
const TEST_PORT_STR = String(TEST_PORT);
let httpServer: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = createRouteApp("/notifications", notificationsRoutes);
  await new Promise<void>((resolve) => {
    httpServer = serve({ fetch: app.fetch, port: TEST_PORT }, () => {
      resolve();
    }) as Server;
  });
  baseUrl = `http://127.0.0.1:${TEST_PORT_STR}`;
});

afterAll(async () => {
  // Force-close any lingering SSE connections so httpServer.close() doesn't hang.
  (httpServer as Server & { closeAllConnections: () => void }).closeAllConnections();
  await new Promise<void>((resolve, reject) => {
    httpServer.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  _resetSseStateForTesting();
  mockPubSub = undefined;
  capturedHandler = null;
});

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Open an SSE connection and return an AbortController to close it. */
function openSse(headers?: Record<string, string>): {
  controller: AbortController;
  responsePromise: Promise<Response>;
} {
  const controller = new AbortController();
  const responsePromise = fetch(`${baseUrl}/notifications/stream`, {
    method: "GET",
    headers: { Authorization: `Bearer fake-token`, ...headers },
    signal: controller.signal,
  });
  return { controller, responsePromise };
}

/** Portable reader type that works across Node/Bun lib differences. */
type SseReader = {
  read(): Promise<{ value?: Uint8Array | undefined; done: boolean }>;
  cancel(reason?: unknown): Promise<void>;
};

/**
 * Abort a connection cleanly: cancel the reader first (stops buffering), then
 * abort the controller. The AbortError thrown by the in-flight fetch promise is
 * swallowed here so callers don't need try/catch.
 */
async function closeSse(controller: AbortController, reader?: SseReader): Promise<void> {
  if (reader) {
    await reader.cancel().catch(() => undefined);
  }
  controller.abort();
  await new Promise<void>((r) => setTimeout(r, 50));
}

/** Read SSE chunks until a double-newline separator is found or timeout elapses. */
async function readNextEvent(reader: SseReader, timeoutMs = 3000): Promise<string> {
  const decoder = new TextDecoder();
  const deadline = Date.now() + timeoutMs;
  let buf = "";
  while (Date.now() < deadline) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value);
    const sep = buf.indexOf("\n\n");
    if (sep !== -1) return buf.slice(0, sep);
  }
  return buf;
}

/** Poll a condition until it is truthy or a timeout expires. */
async function waitFor(condition: () => boolean, timeoutMs = 3000, intervalMs = 25): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition() && Date.now() < deadline) {
    await new Promise<void>((r) => setTimeout(r, intervalMs));
  }
  if (!condition()) throw new Error("waitFor timed out");
}

/** Read chunks from a reader into an accumulator until done or cancelled. */
function drainReader(reader: SseReader, accumulator: string[]): void {
  const decoder = new TextDecoder();
  const loop = (): void => {
    reader.read().then(
      ({ value, done }) => {
        if (done) return;
        accumulator.push(decoder.decode(value));
        loop();
      },
      () => {
        // reader cancelled or stream closed — stop looping
      },
    );
  };
  loop();
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("GET /notifications/stream (integration — real HTTP server)", () => {
  it("returns 200 with text/event-stream", async () => {
    const { controller, responsePromise } = openSse();
    const res = await responsePromise;
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");
    controller.abort();
    await new Promise<void>((r) => setTimeout(r, 50));
  });

  it("sends immediate heartbeat comment on connect", async () => {
    const { controller, responsePromise } = openSse();
    const res = await responsePromise;
    if (!res.body) throw new Error("expected response body");
    const reader = res.body.getReader();
    const text = await readNextEvent(reader);
    expect(text).toContain(": heartbeat");
    await closeSse(controller, reader);
  });

  // ── finally block: cleanup on client abort ───────────────────────────────

  it("removes stream from state when client aborts (finally block runs)", async () => {
    mockPubSub = createMockPubSub();
    const pubsub = mockPubSub;
    const { controller, responsePromise } = openSse();
    const res = await responsePromise;
    if (!res.body) throw new Error("expected response body");
    const reader = res.body.getReader();
    await readNextEvent(reader);
    await closeSse(controller, reader);

    // After the sole stream disconnects, the finally block must remove it from
    // sseState and call pubsub.unsubscribe once. If the finally block never ran,
    // unsubscribe would never be invoked and waitFor would time out.
    await waitFor(() => (pubsub.unsubscribe as ReturnType<typeof vi.fn>).mock.calls.length > 0);
    expect(pubsub.unsubscribe).toHaveBeenCalledOnce();
  });

  it("only logs the no-pubsub warning once across multiple connections", async () => {
    const { logger } = await import("../../../lib/logger.js");
    const warnMock = vi.mocked(logger)["warn"];

    const { controller: c1, responsePromise: p1 } = openSse();
    await p1;
    await new Promise<void>((r) => setTimeout(r, 50));
    const callsBefore = warnMock.mock.calls.length;

    // Second connection — noPubSubWarningLogged is already true, no new warn
    const { controller: c2, responsePromise: p2 } = openSse();
    await p2;
    await new Promise<void>((r) => setTimeout(r, 50));
    const callsAfter = warnMock.mock.calls.length;

    expect(callsAfter).toBe(callsBefore);

    c1.abort();
    c2.abort();
    await new Promise<void>((r) => setTimeout(r, 50));
  });

  // ── cleanup: two streams, one aborts first (size remains > 0) ────────────

  it("keeps sseState when a second stream is still connected after first aborts", async () => {
    mockPubSub = createMockPubSub();
    const pubsub = mockPubSub;
    const { controller: c1, responsePromise: p1 } = openSse();
    const { controller: c2, responsePromise: p2 } = openSse();

    const res1 = await p1;
    const res2 = await p2;

    if (!res1.body) throw new Error("expected res1 body");
    if (!res2.body) throw new Error("expected res2 body");

    const reader1 = res1.body.getReader();
    const reader2 = res2.body.getReader();

    await readNextEvent(reader1);
    await readNextEvent(reader2);

    // Abort only the first — state.streams.size goes 2 → 1, NOT 0. The pubsub
    // subscription is shared across both streams, so unsubscribe must NOT have
    // been called yet.
    await closeSse(c1, reader1);
    await new Promise<void>((r) => setTimeout(r, 100));
    expect(pubsub.unsubscribe).not.toHaveBeenCalled();

    // Now abort the second. With streams.size → 0, unsubscribe is invoked once.
    await closeSse(c2, reader2);
    await waitFor(() => (pubsub.unsubscribe as ReturnType<typeof vi.fn>).mock.calls.length > 0);
    expect(pubsub.unsubscribe).toHaveBeenCalledOnce();
  });

  // ── pubsub unsubscribe on last stream close ───────────────────────────────

  it("calls pubsub.unsubscribe when last stream disconnects", async () => {
    mockPubSub = createMockPubSub();
    const pubsub = mockPubSub;
    const { controller, responsePromise } = openSse();
    const res = await responsePromise;

    if (!res.body) throw new Error("expected response body");
    const reader = res.body.getReader();
    await readNextEvent(reader);
    await closeSse(controller, reader);

    await waitFor(() => (pubsub.unsubscribe as ReturnType<typeof vi.fn>).mock.calls.length > 0);
    expect(pubsub.unsubscribe).toHaveBeenCalledOnce();
  });

  it("does NOT call pubsub.unsubscribe when a second stream remains connected", async () => {
    mockPubSub = createMockPubSub();
    const pubsub = mockPubSub;

    const { controller: c1, responsePromise: p1 } = openSse();
    const { controller: c2, responsePromise: p2 } = openSse();

    const res1 = await p1;
    const res2 = await p2;

    if (!res1.body) throw new Error("expected res1 body");
    if (!res2.body) throw new Error("expected res2 body");

    const reader1 = res1.body.getReader();
    const reader2 = res2.body.getReader();

    await readNextEvent(reader1);
    await readNextEvent(reader2);

    // Abort only stream 1 — stream 2 still open, unsubscribe must NOT be called
    await closeSse(c1, reader1);
    await new Promise<void>((r) => setTimeout(r, 150));

    expect(pubsub.unsubscribe).not.toHaveBeenCalled();

    await closeSse(c2, reader2);
    await waitFor(() => (pubsub.unsubscribe as ReturnType<typeof vi.fn>).mock.calls.length > 0);
  });

  // ── handler: event type fallback and data nullish coalescing ─────────────

  it("uses 'notification' as event type when parsed.event is not a string", async () => {
    mockPubSub = createMockPubSub();
    const { controller, responsePromise } = openSse();
    const res = await responsePromise;
    if (!res.body) throw new Error("expected response body");
    const reader = res.body.getReader();
    await readNextEvent(reader); // consume heartbeat

    await waitFor(() => capturedHandler !== null);
    const handler = capturedHandler;
    if (!handler) throw new Error("handler not captured");

    const received: string[] = [];
    drainReader(reader, received);

    handler(JSON.stringify({ data: { value: 42 } }));
    await new Promise<void>((r) => setTimeout(r, 150));

    expect(received.join("")).toContain("event: notification");

    await closeSse(controller, reader);
  });

  it("serializes the entire parsed object as data when parsed.data is absent", async () => {
    mockPubSub = createMockPubSub();
    const { controller, responsePromise } = openSse();
    const res = await responsePromise;
    if (!res.body) throw new Error("expected response body");
    const reader = res.body.getReader();
    await readNextEvent(reader); // consume heartbeat

    await waitFor(() => capturedHandler !== null);
    const handler = capturedHandler;
    if (!handler) throw new Error("handler not captured");

    const received: string[] = [];
    drainReader(reader, received);

    // No `data` field — data should be JSON.stringify(parsed) i.e. the whole object
    handler(JSON.stringify({ event: "test-event" }));
    await new Promise<void>((r) => setTimeout(r, 150));

    const combined = received.join("");
    expect(combined).toContain("event: test-event");
    expect(combined).toContain('"event":"test-event"');

    await closeSse(controller, reader);
  });

  // ── Last-Event-ID: replay of events already in buffer ────────────────────

  it("replays buffered events when reconnecting with a known Last-Event-ID", async () => {
    mockPubSub = createMockPubSub();

    // First connection — stays open while we publish events, then a second
    // connection with Last-Event-ID arrives while the buffer is still alive.
    const { controller: c1, responsePromise: p1 } = openSse();
    const res1 = await p1;
    if (!res1.body) throw new Error("expected res1 body");
    const reader1 = res1.body.getReader();
    await readNextEvent(reader1); // consume heartbeat

    await waitFor(() => capturedHandler !== null);
    const handler = capturedHandler;
    if (!handler) throw new Error("handler not captured");

    // Push two events: id=1 (ev1), id=2 (ev2)
    handler(JSON.stringify({ event: "ev1", data: "first" }));
    await new Promise<void>((r) => setTimeout(r, 50));
    handler(JSON.stringify({ event: "ev2", data: "second" }));
    await new Promise<void>((r) => setTimeout(r, 50));

    // Reconnect with Last-Event-ID: 1 — buffer.since("1") returns [ev2]
    const { controller: c2, responsePromise: p2 } = openSse({ "Last-Event-ID": "1" });
    const res2 = await p2;
    if (!res2.body) throw new Error("expected res2 body");

    // Collect all SSE data from c2 for a bounded window
    const c2Chunks: string[] = [];
    const c2Reader = res2.body.getReader();
    drainReader(c2Reader, c2Chunks);

    // Allow time for heartbeat + replayed events to arrive
    await new Promise<void>((r) => setTimeout(r, 500));

    const c2Text = c2Chunks.join("");
    expect(c2Text).toContain("event: ev2");

    await closeSse(c1, reader1);
    await closeSse(c2, c2Reader);
    await new Promise<void>((r) => setTimeout(r, 100));
  });

  // ── 429 when connection limit is reached ─────────────────────────────────

  it("returns 429 when the per-account SSE connection limit is exceeded", async () => {
    const { SSE_MAX_CONNECTIONS_PER_ACCOUNT } = await import("../../../lib/sse.constants.js");

    for (let i = 0; i < SSE_MAX_CONNECTIONS_PER_ACCOUNT; i++) {
      _addMockStreamForTesting(MOCK_AUTH.accountId);
    }

    const res = await fetch(`${baseUrl}/notifications/stream`, {
      headers: { Authorization: "Bearer fake-token" },
    });

    expect(res.status).toBe(429);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("TOO_MANY_STREAMS");
  });
});
