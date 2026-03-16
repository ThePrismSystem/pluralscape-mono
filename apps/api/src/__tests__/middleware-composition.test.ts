import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface ErrorBody {
  error: { code: string; message: string; details?: unknown };
  requestId: string;
}

describe("middleware composition", () => {
  const originalEnv = process.env["NODE_ENV"];
  const originalTrustProxy = process.env["TRUST_PROXY"];
  const originalCorsOrigin = process.env["CORS_ORIGIN"];

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    if (originalEnv === undefined) {
      delete process.env["NODE_ENV"];
    } else {
      process.env["NODE_ENV"] = originalEnv;
    }
    if (originalTrustProxy === undefined) {
      delete process.env["TRUST_PROXY"];
    } else {
      process.env["TRUST_PROXY"] = originalTrustProxy;
    }
    if (originalCorsOrigin === undefined) {
      delete process.env["CORS_ORIGIN"];
    } else {
      process.env["CORS_ORIGIN"] = originalCorsOrigin;
    }
    vi.restoreAllMocks();
  });

  it("applies secure headers on all responses", async () => {
    const { app } = await import("../index.js");
    const res = await app.request("/health");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("content-security-policy")).toContain("default-src 'self'");
  });

  it("sets X-Request-Id header on all responses", async () => {
    const { app } = await import("../index.js");
    const res = await app.request("/health");
    expect(res.headers.get("x-request-id")).toBeTruthy();
  });

  it("error handler returns structured errors without leaking stack traces", async () => {
    const { Hono } = await import("hono");
    const { createSecureHeaders } = await import("../middleware/secure-headers.js");
    const { createCorsMiddleware } = await import("../middleware/cors.js");
    const { errorHandler } = await import("../middleware/error-handler.js");
    const { createRateLimiter } = await import("../middleware/rate-limit.js");
    const { requestIdMiddleware } = await import("../middleware/request-id.js");

    const testApp = new Hono();
    testApp.use("*", requestIdMiddleware());
    testApp.use("*", createSecureHeaders());
    testApp.use("*", createCorsMiddleware());
    testApp.use("*", createRateLimiter({ limit: 100, windowMs: 60_000 }));
    testApp.onError(errorHandler);
    testApp.get("/boom", () => {
      throw new Error("secret internal details");
    });

    process.env["NODE_ENV"] = "production";
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await testApp.request("/boom");
    expect(res.status).toBe(500);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(body.error.message).toBe("Internal Server Error");
    expect(JSON.stringify(body)).not.toContain("secret internal details");
    expect(body.requestId).toBeTruthy();
    expect(spy).toHaveBeenCalled();
  });

  it("rate limiter returns 429 with structured error after threshold", async () => {
    const { Hono } = await import("hono");
    const { createRateLimiter } = await import("../middleware/rate-limit.js");
    const { errorHandler } = await import("../middleware/error-handler.js");
    const { requestIdMiddleware } = await import("../middleware/request-id.js");

    const testApp = new Hono();
    testApp.use("*", requestIdMiddleware());
    testApp.use("*", createRateLimiter({ limit: 2, windowMs: 60_000 }));
    testApp.onError(errorHandler);
    testApp.get("/test", (c) => c.json({ ok: true }));

    await testApp.request("/test");
    await testApp.request("/test");
    const res = await testApp.request("/test");
    expect(res.status).toBe(429);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe("RATE_LIMITED");
  });

  it("rate limiter includes X-RateLimit-* headers on successful responses", async () => {
    const { app } = await import("../index.js");
    const res = await app.request("/health");
    expect(res.headers.get("x-ratelimit-limit")).toBeTruthy();
    expect(res.headers.get("x-ratelimit-remaining")).toBeTruthy();
    expect(res.headers.get("x-ratelimit-reset")).toBeTruthy();
  });

  it("all middleware cooperate on a single request", async () => {
    const { app } = await import("../index.js");
    const res = await app.request("/");

    // Status and body
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; service: string };
    expect(body.status).toBe("ok");
    expect(body.service).toBe("pluralscape-api");

    // Security headers applied
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("content-security-policy")).toBeTruthy();

    // Request ID present
    expect(res.headers.get("x-request-id")).toBeTruthy();

    // Rate limit headers present
    expect(res.headers.get("x-ratelimit-limit")).toBeTruthy();
  });
});
