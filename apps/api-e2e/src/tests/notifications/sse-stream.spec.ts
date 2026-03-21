/**
 * E2E tests for the SSE notification stream endpoint.
 *
 * These tests verify the Server-Sent Events endpoint at /v1/notifications/stream
 * against a real running API server. The server is spawned by Playwright's
 * globalSetup on port 10099.
 *
 * Note: Without Valkey configured, the SSE stream only emits heartbeat
 * comments. These tests verify the transport-level behavior: connection
 * setup, authentication, content-type, heartbeats, and reconnect semantics.
 */
import { test, expect } from "../../fixtures/auth.fixture.js";

const E2E_PORT = 10_099;
const SSE_BASE_URL = `http://localhost:${String(E2E_PORT)}`;

/** Maximum time to wait for SSE data before timing out. */
const SSE_READ_TIMEOUT_MS = 5_000;

/** Read timeout for the heartbeat test (server interval is 30s). */
const SSE_HEARTBEAT_TIMEOUT_MS = 35_000;

/**
 * Read from an SSE response body until the predicate matches or time out.
 * Throws if the stream closes before the predicate is satisfied.
 */
async function readSseUntil(
  body: ReadableStream<Uint8Array>,
  predicate: (accumulated: string) => boolean,
  timeoutMs: number,
): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let accumulated = "";

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`SSE read timed out after ${String(timeoutMs)}ms`));
    }, timeoutMs);
  });

  try {
    while (!predicate(accumulated)) {
      const result = await Promise.race([reader.read(), timeoutPromise]);
      if (result.done) break;
      accumulated += decoder.decode(result.value, { stream: true });
    }
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }

  if (!predicate(accumulated)) {
    throw new Error(
      `SSE stream closed before predicate was satisfied. Accumulated: ${accumulated}`,
    );
  }

  return accumulated;
}

/**
 * Open an SSE stream, run the callback, and guarantee abort on completion.
 */
async function withSseStream(
  token: string | null,
  fn: (res: Response) => void | Promise<void>,
  extraHeaders?: Record<string, string>,
): Promise<void> {
  const controller = new AbortController();
  const headers: Record<string, string> = { Accept: "text/event-stream" };
  if (token) headers.Authorization = `Bearer ${token}`;
  Object.assign(headers, extraHeaders);
  try {
    const res = await fetch(`${SSE_BASE_URL}/v1/notifications/stream`, {
      headers,
      signal: controller.signal,
    });
    await fn(res);
  } finally {
    controller.abort();
  }
}

test.describe("SSE notification stream", () => {
  test("connects and returns text/event-stream content type", async ({ registeredAccount }) => {
    await withSseStream(registeredAccount.sessionToken, (res) => {
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("text/event-stream");
    });
  });

  test("returns 401 without authentication", async () => {
    await withSseStream(null, (res) => {
      expect(res.status).toBe(401);
    });
  });

  test("returns 401 with an invalid session token", async () => {
    await withSseStream("invalid-token-that-does-not-exist", (res) => {
      expect(res.status).toBe(401);
    });
  });

  test("sets Cache-Control no-cache header", async ({ registeredAccount }) => {
    await withSseStream(registeredAccount.sessionToken, (res) => {
      expect(res.status).toBe(200);
      expect(res.headers.get("Cache-Control")).toContain("no-cache");
    });
  });

  test("receives heartbeat comment within 35 seconds", async ({ registeredAccount }) => {
    test.setTimeout(SSE_HEARTBEAT_TIMEOUT_MS + SSE_READ_TIMEOUT_MS);

    await withSseStream(registeredAccount.sessionToken, async (res) => {
      expect(res.status).toBe(200);
      expect(res.body).toBeTruthy();

      const data = await readSseUntil(
        res.body as ReadableStream<Uint8Array>,
        (text) => text.includes(": heartbeat"),
        SSE_HEARTBEAT_TIMEOUT_MS,
      );

      expect(data).toContain(": heartbeat");
    });
  });

  test("accepts reconnect with Last-Event-ID header", async ({ registeredAccount }) => {
    await withSseStream(
      registeredAccount.sessionToken,
      async (res) => {
        expect(res.status).toBe(200);
        expect(res.headers.get("Content-Type")).toContain("text/event-stream");

        const data = await readSseUntil(
          res.body as ReadableStream<Uint8Array>,
          (text) => text.includes("full-sync"),
          SSE_READ_TIMEOUT_MS,
        );

        expect(data).toContain("event: full-sync");
        expect(data).toContain("replay-window-exceeded");
      },
      { "Last-Event-ID": String(Number.MAX_SAFE_INTEGER) },
    );
  });

  test("handles reconnect with Last-Event-ID of 0 gracefully", async ({ registeredAccount }) => {
    await withSseStream(
      registeredAccount.sessionToken,
      (res) => {
        expect(res.status).toBe(200);
        expect(res.headers.get("Content-Type")).toContain("text/event-stream");
      },
      { "Last-Event-ID": "0" },
    );
  });

  test("multiple concurrent SSE connections from same account succeed", async ({
    registeredAccount,
  }) => {
    const controllers = [new AbortController(), new AbortController()];

    try {
      const responses = await Promise.all(
        controllers.map((ctrl) =>
          fetch(`${SSE_BASE_URL}/v1/notifications/stream`, {
            headers: {
              Authorization: `Bearer ${registeredAccount.sessionToken}`,
              Accept: "text/event-stream",
            },
            signal: ctrl.signal,
          }),
        ),
      );

      for (const res of responses) {
        expect(res.status).toBe(200);
        expect(res.headers.get("Content-Type")).toContain("text/event-stream");
      }
    } finally {
      for (const ctrl of controllers) {
        ctrl.abort();
      }
    }
  });
});
