import { RATE_LIMITS } from "@pluralscape/types";
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../middleware/error-handler.js";
import { createCategoryRateLimiter, createRateLimiter } from "../middleware/rate-limit.js";
import { requestIdMiddleware } from "../middleware/request-id.js";

interface ErrorBody {
  error: { code: string; message: string; details?: unknown };
  requestId: string;
}

describe("rate limiter middleware", () => {
  const originalTrustProxy = process.env["TRUST_PROXY"];

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    if (originalTrustProxy === undefined) {
      delete process.env["TRUST_PROXY"];
    } else {
      process.env["TRUST_PROXY"] = originalTrustProxy;
    }
  });

  function createApp(limit = 3, windowMs = 60_000): Hono {
    const app = new Hono();
    app.use("*", requestIdMiddleware());
    app.use("*", createRateLimiter({ limit, windowMs }));
    app.onError(errorHandler);
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

  it("TRUST_PROXY unset: x-forwarded-for is ignored, all requests share global bucket", async () => {
    delete process.env["TRUST_PROXY"];
    const app = createApp(2);

    await app.request("/test", {
      headers: { "x-forwarded-for": "1.1.1.1" },
    });
    await app.request("/test", {
      headers: { "x-forwarded-for": "2.2.2.2" },
    });
    const res = await app.request("/test", {
      headers: { "x-forwarded-for": "3.3.3.3" },
    });
    expect(res.status).toBe(429);
  });

  it("TRUST_PROXY=1: tracks clients independently by x-forwarded-for", async () => {
    process.env["TRUST_PROXY"] = "1";
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

  it("evicts expired entries when store exceeds threshold", async () => {
    process.env["TRUST_PROXY"] = "1";
    const app = createApp(1, 1_000);

    for (let i = 0; i < 5; i++) {
      await app.request("/test", {
        headers: { "x-forwarded-for": `10.0.0.${String(i)}` },
      });
    }

    vi.advanceTimersByTime(1_001);

    const res = await app.request("/test", {
      headers: { "x-forwarded-for": "10.0.0.0" },
    });
    expect(res.status).toBe(200);
  });

  // ── X-RateLimit-* header tests ────────────────────────────────────

  it("includes X-RateLimit-Limit header on successful response", async () => {
    const app = createApp(5, 60_000);
    const res = await app.request("/test");
    expect(res.headers.get("x-ratelimit-limit")).toBe("5");
  });

  it("X-RateLimit-Remaining decrements with each request", async () => {
    const app = createApp(5, 60_000);

    const res1 = await app.request("/test");
    expect(res1.headers.get("x-ratelimit-remaining")).toBe("4");

    const res2 = await app.request("/test");
    expect(res2.headers.get("x-ratelimit-remaining")).toBe("3");

    const res3 = await app.request("/test");
    expect(res3.headers.get("x-ratelimit-remaining")).toBe("2");
  });

  it("X-RateLimit-Reset is a Unix timestamp in seconds", async () => {
    const app = createApp(5, 60_000);
    const res = await app.request("/test");
    const reset = Number(res.headers.get("x-ratelimit-reset"));
    expect(reset).toBeGreaterThan(0);
    // Should be in seconds, not milliseconds (less than year-2100 in seconds)
    const MAX_REASONABLE_SECONDS = 5_000_000_000;
    expect(reset).toBeLessThan(MAX_REASONABLE_SECONDS);
  });

  it("429 response has structured error format with RATE_LIMITED code", async () => {
    const app = createApp(1);
    await app.request("/test");
    const res = await app.request("/test");
    expect(res.status).toBe(429);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe("RATE_LIMITED");
    expect(body.error.message).toBe("Too many requests");
    expect(body.requestId).toBeTruthy();
  });

  it("429 response still includes X-RateLimit-* headers", async () => {
    const app = createApp(1);
    await app.request("/test");
    const res = await app.request("/test");
    expect(res.status).toBe(429);
    expect(res.headers.get("x-ratelimit-limit")).toBe("1");
    expect(res.headers.get("x-ratelimit-remaining")).toBe("0");
    expect(res.headers.get("x-ratelimit-reset")).toBeTruthy();
  });

  // ── Category rate limiter ─────────────────────────────────────────

  it("createCategoryRateLimiter uses RATE_LIMITS constants", async () => {
    const app = new Hono();
    app.use("*", requestIdMiddleware());
    app.use("*", createCategoryRateLimiter("authHeavy"));
    app.onError(errorHandler);
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("/test");
    expect(res.headers.get("x-ratelimit-limit")).toBe(String(RATE_LIMITS.authHeavy.limit));
  });
});
