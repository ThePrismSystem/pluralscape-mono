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

/** Heartbeat interval is 30s on the server, but we only check initial data arrives. */
const HEARTBEAT_WAIT_MS = 35_000;

/**
 * Read from an SSE response body until we find a matching line or time out.
 * Returns the accumulated text.
 */
async function readSseUntil(
  body: ReadableStream<Uint8Array>,
  predicate: (accumulated: string) => boolean,
  timeoutMs: number,
): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let accumulated = "";

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
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
    reader.releaseLock();
  }

  return accumulated;
}

test.describe("SSE notification stream", () => {
  test("connects and returns text/event-stream content type", async ({ registeredAccount }) => {
    const controller = new AbortController();

    try {
      const res = await fetch(`${SSE_BASE_URL}/v1/notifications/stream`, {
        headers: {
          Authorization: `Bearer ${registeredAccount.sessionToken}`,
          Accept: "text/event-stream",
        },
        signal: controller.signal,
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("text/event-stream");
    } finally {
      controller.abort();
    }
  });

  test("returns 401 without authentication", async () => {
    const controller = new AbortController();

    try {
      const res = await fetch(`${SSE_BASE_URL}/v1/notifications/stream`, {
        headers: { Accept: "text/event-stream" },
        signal: controller.signal,
      });

      // Auth middleware should reject unauthenticated requests
      expect(res.status).toBe(401);
    } finally {
      controller.abort();
    }
  });

  test("returns 401 with an invalid session token", async () => {
    const controller = new AbortController();

    try {
      const res = await fetch(`${SSE_BASE_URL}/v1/notifications/stream`, {
        headers: {
          Authorization: "Bearer invalid-token-that-does-not-exist",
          Accept: "text/event-stream",
        },
        signal: controller.signal,
      });

      expect(res.status).toBe(401);
    } finally {
      controller.abort();
    }
  });

  test("sets Cache-Control no-cache header", async ({ registeredAccount }) => {
    const controller = new AbortController();

    try {
      const res = await fetch(`${SSE_BASE_URL}/v1/notifications/stream`, {
        headers: {
          Authorization: `Bearer ${registeredAccount.sessionToken}`,
          Accept: "text/event-stream",
        },
        signal: controller.signal,
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("Cache-Control")).toContain("no-cache");
    } finally {
      controller.abort();
    }
  });

  test("receives heartbeat comment within 35 seconds", async ({ registeredAccount }) => {
    test.setTimeout(HEARTBEAT_WAIT_MS + SSE_READ_TIMEOUT_MS);

    const controller = new AbortController();

    try {
      const res = await fetch(`${SSE_BASE_URL}/v1/notifications/stream`, {
        headers: {
          Authorization: `Bearer ${registeredAccount.sessionToken}`,
          Accept: "text/event-stream",
        },
        signal: controller.signal,
      });

      expect(res.status).toBe(200);
      expect(res.body).toBeTruthy();

      // Read until we see a heartbeat comment (": heartbeat")
      const data = await readSseUntil(
        res.body as ReadableStream<Uint8Array>,
        (text) => text.includes(": heartbeat"),
        HEARTBEAT_WAIT_MS,
      );

      expect(data).toContain(": heartbeat");
    } finally {
      controller.abort();
    }
  });

  test("accepts reconnect with Last-Event-ID header", async ({ registeredAccount }) => {
    const controller = new AbortController();

    try {
      // Connect with a stale Last-Event-ID that the server has never seen
      // (server just started, buffer is empty, ID 999999 is beyond nextId)
      // This should trigger a "full-sync" event
      const res = await fetch(`${SSE_BASE_URL}/v1/notifications/stream`, {
        headers: {
          Authorization: `Bearer ${registeredAccount.sessionToken}`,
          Accept: "text/event-stream",
          "Last-Event-ID": "999999",
        },
        signal: controller.signal,
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("text/event-stream");

      // The server should send a full-sync event because the Last-Event-ID
      // is beyond the server's current event counter (restart detection)
      const data = await readSseUntil(
        res.body as ReadableStream<Uint8Array>,
        (text) => text.includes("full-sync"),
        SSE_READ_TIMEOUT_MS,
      );

      expect(data).toContain("event: full-sync");
      expect(data).toContain("replay-window-exceeded");
    } finally {
      controller.abort();
    }
  });

  test("handles reconnect with Last-Event-ID of 0 gracefully", async ({ registeredAccount }) => {
    const controller = new AbortController();

    try {
      // Last-Event-ID of "0" means "give me everything" — with an empty buffer,
      // there's nothing to replay, so the server should just proceed normally
      const res = await fetch(`${SSE_BASE_URL}/v1/notifications/stream`, {
        headers: {
          Authorization: `Bearer ${registeredAccount.sessionToken}`,
          Accept: "text/event-stream",
          "Last-Event-ID": "0",
        },
        signal: controller.signal,
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("text/event-stream");
    } finally {
      controller.abort();
    }
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

      // Both connections should succeed (limit is 5 per account)
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
