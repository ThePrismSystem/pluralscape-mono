import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

  it("error handler catches unhandled errors without leaking stack traces", async () => {
    const { Hono } = await import("hono");
    const { createSecureHeaders } = await import("../middleware/secure-headers.js");
    const { createCorsMiddleware } = await import("../middleware/cors.js");
    const { errorHandler } = await import("../middleware/error-handler.js");
    const { createRateLimiter } = await import("../middleware/rate-limit.js");

    const testApp = new Hono();
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
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Internal Server Error");
    expect(JSON.stringify(body)).not.toContain("secret internal details");
    expect(spy).toHaveBeenCalled();
  });

  it("rate limiter returns 429 after threshold", async () => {
    const { Hono } = await import("hono");
    const { createRateLimiter } = await import("../middleware/rate-limit.js");
    const { errorHandler } = await import("../middleware/error-handler.js");

    const testApp = new Hono();
    testApp.use("*", createRateLimiter({ limit: 2, windowMs: 60_000 }));
    testApp.onError(errorHandler);
    testApp.get("/test", (c) => c.json({ ok: true }));

    await testApp.request("/test");
    await testApp.request("/test");
    const res = await testApp.request("/test");
    expect(res.status).toBe(429);
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
  });
});
