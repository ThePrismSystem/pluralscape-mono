import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createRateLimiter } from "../middleware/rate-limit.js";

describe("rate limiter middleware", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function createApp(limit = 3, windowMs = 60_000): Hono {
    const app = new Hono();
    app.use("*", createRateLimiter({ limit, windowMs }));
    app.get("/test", (c) => c.json({ ok: true }));
    return app;
  }

  it("allows requests within the limit", async () => {
    const app = createApp(3);
    for (let i = 0; i < 3; i++) {
      const res = await app.request("/test");
      expect(res.status).toBe(200);
    }
  });

  it("returns 429 when limit is exceeded", async () => {
    const app = createApp(2);
    await app.request("/test");
    await app.request("/test");
    const res = await app.request("/test");
    expect(res.status).toBe(429);
  });

  it("includes Retry-After header on 429", async () => {
    const app = createApp(1, 60_000);
    await app.request("/test");
    const res = await app.request("/test");
    expect(res.status).toBe(429);
    const retryAfter = res.headers.get("retry-after");
    expect(retryAfter).toBeTruthy();
    expect(Number(retryAfter)).toBeGreaterThan(0);
  });

  it("resets after the window expires", async () => {
    const app = createApp(1, 10_000);
    await app.request("/test");
    const blocked = await app.request("/test");
    expect(blocked.status).toBe(429);

    vi.advanceTimersByTime(10_001);

    const afterReset = await app.request("/test");
    expect(afterReset.status).toBe(200);
  });

  it("tracks clients independently by IP", async () => {
    const app = createApp(1);
    const res1 = await app.request("/test", {
      headers: { "x-forwarded-for": "1.1.1.1" },
    });
    expect(res1.status).toBe(200);

    const res2 = await app.request("/test", {
      headers: { "x-forwarded-for": "2.2.2.2" },
    });
    expect(res2.status).toBe(200);

    const res1Again = await app.request("/test", {
      headers: { "x-forwarded-for": "1.1.1.1" },
    });
    expect(res1Again.status).toBe(429);
  });

  it("returns JSON error body on 429", async () => {
    const app = createApp(1);
    await app.request("/test");
    const res = await app.request("/test");
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("Too many requests");
  });
});
