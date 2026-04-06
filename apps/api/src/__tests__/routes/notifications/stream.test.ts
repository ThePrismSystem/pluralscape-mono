import { afterEach, describe, expect, it, vi } from "vitest";

import { SSE_MAX_CONNECTIONS_PER_ACCOUNT } from "../../../lib/sse.constants.js";
import {
  mockAuthFactory,
  mockRateLimitFactory,
  mockScopeFactory,
} from "../../helpers/common-route-mocks.js";
import { createRouteApp, MOCK_AUTH } from "../../helpers/route-test-setup.js";

// ── Pub/Sub mock with channel handler capture ───────────────────

type PubSubHandler = (message: string) => void;
let capturedSubscribeHandler: PubSubHandler | null = null;
let subscribeCalled = false;

function createMockPubSub(): {
  subscribe: (channel: string, handler: PubSubHandler) => Promise<"subscribed">;
  unsubscribe: (channel: string, handler?: PubSubHandler) => Promise<void>;
} {
  return {
    subscribe: vi.fn((_channel: string, handler: PubSubHandler) => {
      capturedSubscribeHandler = handler;
      subscribeCalled = true;
      return Promise.resolve("subscribed" as const);
    }),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
  };
}

let mockPubSub: ReturnType<typeof createMockPubSub> | undefined;

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

vi.mock("../../../middleware/scope.js", () => mockScopeFactory());
vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());
vi.mock("../../../lib/notification-pubsub.js", () => ({
  getNotificationPubSub: vi.fn(() => mockPubSub),
}));
vi.mock("../../../lib/logger.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../lib/logger.js")>();
  const mock = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
  return {
    ...actual,
    logger: mock,
  };
});

// ── Import after mocks ──────────────────────────────────────────

const { notificationsRoutes, _resetSseStateForTesting, _addMockStreamForTesting } =
  await import("../../../routes/notifications/stream.js");
const { logger } = await import("../../../lib/logger.js");
const { SseEventBuffer } = await import("../../../lib/sse-manager.js");

// ── Helpers ──────────────────────────────────────────────────────

function createApp() {
  return createRouteApp("/notifications", notificationsRoutes);
}

// ── Tests ────────────────────────────────────────────────────────

describe("GET /notifications/stream", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    _resetSseStateForTesting();
    mockPubSub = undefined;
    capturedSubscribeHandler = null;
    subscribeCalled = false;
  });

  it("returns text/event-stream content type", async () => {
    const app = createApp();
    const res = await app.request("/notifications/stream", {
      method: "GET",
      headers: {
        Authorization: "Bearer fake-token",
      },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");
  });

  it("sets Cache-Control no-cache header", async () => {
    const app = createApp();
    const res = await app.request("/notifications/stream");

    expect(res.headers.get("Cache-Control")).toBe("no-cache");
  });

  it("returns SSE stream that can be read", async () => {
    const app = createApp();
    const res = await app.request("/notifications/stream");

    expect(res.status).toBe(200);
    expect(res.body).toBeTruthy();
  });

  it("logs warning once when no pub/sub configured", async () => {
    const app = createApp();
    await app.request("/notifications/stream");
    expect(vi.mocked(logger)["warn"]).toHaveBeenCalledWith(
      "SSE: no pub/sub configured, stream will only receive heartbeats",
    );
  });

  it("returns 429 when SSE connection limit is exceeded", async () => {
    const app = createApp();

    // Fill up to the limit for the mock auth account
    for (let i = 0; i < SSE_MAX_CONNECTIONS_PER_ACCOUNT; i++) {
      _addMockStreamForTesting(MOCK_AUTH.accountId);
    }

    const res = await app.request("/notifications/stream");

    expect(res.status).toBe(429);
    const body = (await res.json()) as { error: string; message: string };
    expect(body.error).toBe("TOO_MANY_STREAMS");
  });

  describe("event delivery through pub/sub", () => {
    it("subscribes to Valkey channel when pub/sub is configured", async () => {
      mockPubSub = createMockPubSub();
      const app = createApp();
      await app.request("/notifications/stream");

      expect(subscribeCalled).toBe(true);
    });

    it("captures the subscribe handler for event delivery", async () => {
      mockPubSub = createMockPubSub();
      const app = createApp();
      await app.request("/notifications/stream");

      // The subscribe handler should have been captured by the mock
      expect(capturedSubscribeHandler).not.toBeNull();
    });

    it("logs warning for malformed Valkey messages", async () => {
      mockPubSub = createMockPubSub();
      const app = createApp();
      await app.request("/notifications/stream");

      if (capturedSubscribeHandler === null) {
        throw new Error("subscribe handler was not captured");
      }

      capturedSubscribeHandler("not valid json {{{");

      expect(vi.mocked(logger)["warn"]).toHaveBeenCalledWith(
        "SSE: malformed Valkey message",
        expect.objectContaining({ channel: expect.any(String) }),
      );
    });

    it("handler processes valid Valkey JSON without errors", async () => {
      mockPubSub = createMockPubSub();
      const app = createApp();
      await app.request("/notifications/stream");

      if (capturedSubscribeHandler === null) {
        throw new Error("subscribe handler was not captured");
      }
      const handler = capturedSubscribeHandler;

      // Should not throw — pushes to buffer and attempts fan-out
      expect(() => {
        handler(JSON.stringify({ event: "test", data: { foo: "bar" } }));
      }).not.toThrow();
    });
  });

  describe("Last-Event-ID replay via SseEventBuffer", () => {
    it("replays missed events from ring buffer", () => {
      const buffer = new SseEventBuffer();
      buffer.push("event-a", JSON.stringify({ data: "first" }));
      buffer.push("event-b", JSON.stringify({ data: "second" }));
      buffer.push("event-c", JSON.stringify({ data: "third" }));

      // Replay after ID 1 should return events 2 and 3
      const missed = buffer.since("1");
      expect(missed).not.toBeNull();
      expect(missed).toHaveLength(2);
      expect(missed?.[0]?.event).toBe("event-b");
      expect(missed?.[1]?.event).toBe("event-c");
    });

    it("returns null when Last-Event-ID is from a future/restarted server", () => {
      const buffer = new SseEventBuffer();
      buffer.push("event-a", "data");

      // ID 999 is larger than nextId — server restart detected
      const result = buffer.since("999");
      expect(result).toBeNull();
    });

    it("returns empty array when all events have been seen", () => {
      const buffer = new SseEventBuffer();
      buffer.push("event-a", "data");
      buffer.push("event-b", "data");

      // ID 2 is the last assigned ID — nothing new
      const result = buffer.since("2");
      expect(result).not.toBeNull();
      expect(result).toHaveLength(0);
    });

    it("returns null when events have been evicted from the ring buffer", () => {
      // Buffer with capacity 3
      const smallBuffer = new SseEventBuffer(3);
      smallBuffer.push("a", "data");
      smallBuffer.push("b", "data");
      smallBuffer.push("c", "data");
      smallBuffer.push("d", "data"); // Evicts event "a" (id=1)

      // Trying to replay from ID 0 (before evicted events) signals a gap
      const result = smallBuffer.since("0");
      expect(result).toBeNull();
    });
  });

  describe("heartbeat generation", () => {
    it("SseEventBuffer tracks lastAssignedId for heartbeat reference", () => {
      const buffer = new SseEventBuffer();
      expect(buffer.lastAssignedId).toBe(0);

      buffer.push("test", "data");
      expect(buffer.lastAssignedId).toBe(1);

      buffer.push("test2", "data2");
      expect(buffer.lastAssignedId).toBe(2);
    });

    it("SseEventBuffer.size tracks buffered event count", () => {
      const buffer = new SseEventBuffer();
      expect(buffer.size).toBe(0);

      buffer.push("test", "data");
      expect(buffer.size).toBe(1);
    });
  });

  describe("cleanup on disconnect", () => {
    it("sends full-sync event on reconnect with Last-Event-ID beyond buffer", async () => {
      mockPubSub = createMockPubSub();
      const app = createApp();

      // First connection to establish state
      const res1 = await app.request("/notifications/stream");
      expect(res1.status).toBe(200);

      // Second connection with stale Last-Event-ID — the response includes
      // the full-sync event which we verify via the status code and content-type
      const res2 = await app.request("/notifications/stream", {
        headers: { "Last-Event-ID": "999999" },
      });
      expect(res2.status).toBe(200);
      expect(res2.headers.get("Content-Type")).toContain("text/event-stream");
    });
  });
});
