import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import { requestIdMiddleware } from "../../middleware/request-id.js";

import type { Env } from "hono";

// ── Helpers ──────────────────────────────────────────────────────────

interface RequestIdEnv extends Env {
  Variables: {
    requestId: string;
  };
}

function createApp(): Hono<RequestIdEnv> {
  const app = new Hono<RequestIdEnv>();
  app.use("*", requestIdMiddleware());
  app.get("/test", (c) => c.json({ requestId: c.get("requestId") }));
  return app;
}

/** UUIDv7 pattern: version nibble is 7, variant bits are 10xx. */
const UUIDV7_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// ── Tests ────────────────────────────────────────────────────────────

describe("requestIdMiddleware", () => {
  it("sets X-Request-Id response header", async () => {
    const app = createApp();
    const res = await app.request("/test");

    expect(res.status).toBe(200);
    const requestId = res.headers.get("X-Request-Id");
    expect(requestId).toBeDefined();
    expect(typeof requestId).toBe("string");
  });

  it("generates a UUIDv7 (version 7, variant 10xx)", async () => {
    const app = createApp();
    const res = await app.request("/test");

    const requestId = res.headers.get("X-Request-Id");
    expect(requestId).toBeDefined();
    expect(requestId).toMatch(UUIDV7_PATTERN);
  });

  it("stores the request ID on context variables", async () => {
    const app = createApp();
    const res = await app.request("/test");

    const body = (await res.json()) as { requestId: string };
    const headerValue = res.headers.get("X-Request-Id");
    expect(body.requestId).toBe(headerValue);
  });

  it("generates unique IDs for each request", async () => {
    const app = createApp();
    const res1 = await app.request("/test");
    const res2 = await app.request("/test");

    const id1 = res1.headers.get("X-Request-Id");
    const id2 = res2.headers.get("X-Request-Id");
    expect(id1).not.toBe(id2);
  });

  it("generates time-ordered IDs (UUIDv7 property)", async () => {
    const app = createApp();
    const res1 = await app.request("/test");
    const res2 = await app.request("/test");

    const id1 = res1.headers.get("X-Request-Id") ?? "";
    const id2 = res2.headers.get("X-Request-Id") ?? "";

    // UUIDv7 encodes timestamp in the first 48 bits — lexicographic order matches time order
    expect(id1 < id2 || id1 === id2).toBe(true);
  });
});
