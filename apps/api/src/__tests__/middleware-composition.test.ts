import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApiErrorResponse } from "@pluralscape/types";

const mockEnv = vi.hoisted(() => ({
  NODE_ENV: "test" as "development" | "test" | "production",
  LOG_LEVEL: "info" as const,
  TRUST_PROXY: false,
  DISABLE_RATE_LIMIT: false,
  CORS_ORIGIN: undefined as string | undefined,
}));

vi.mock("../env.js", () => ({ env: mockEnv }));

describe("middleware composition", () => {
  afterEach(() => {
    mockEnv.NODE_ENV = "test";
    mockEnv.TRUST_PROXY = false;
    mockEnv.CORS_ORIGIN = undefined;
    vi.restoreAllMocks();
  });

  it("applies secure headers on all responses", async () => {
    const { Hono } = await import("hono");
    const { createSecureHeaders } = await import("../middleware/secure-headers.js");

    const testApp = new Hono();
    testApp.use("*", createSecureHeaders());
    testApp.get("/health", (c) => c.json({ status: "healthy" }));

    const res = await testApp.request("/health");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("content-security-policy")).toContain("default-src 'none'");
  });

  it("sets X-Request-Id header on all responses", async () => {
    const { Hono } = await import("hono");
    const { requestIdMiddleware } = await import("../middleware/request-id.js");

    const testApp = new Hono();
    testApp.use("*", requestIdMiddleware());
    testApp.get("/health", (c) => c.json({ status: "healthy" }));

    const res = await testApp.request("/health");
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

    mockEnv.NODE_ENV = "production";
    const res = await testApp.request("/boom");
    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(body.error.message).toBe("Internal Server Error");
    expect(JSON.stringify(body)).not.toContain("secret internal details");
    expect(body.requestId).toBeTruthy();
  });

  it("rate limiter returns 429 with structured error after threshold", async () => {
    vi.useFakeTimers();
    try {
      const { Hono } = await import("hono");
      const { createRateLimiter } = await import("../middleware/rate-limit.js");
      const { requestIdMiddleware } = await import("../middleware/request-id.js");

      const testApp = new Hono();
      testApp.use("*", requestIdMiddleware());
      testApp.use("*", createRateLimiter({ limit: 2, windowMs: 60_000 }));
      testApp.get("/test", (c) => c.json({ ok: true }));

      await testApp.request("/test");
      await testApp.request("/test");
      const res = await testApp.request("/test");
      expect(res.status).toBe(429);
      const body = (await res.json()) as ApiErrorResponse;
      expect(body.error.code).toBe("RATE_LIMITED");
    } finally {
      vi.useRealTimers();
    }
  });

  it("rate limiter includes X-RateLimit-* headers on successful responses", async () => {
    const { Hono } = await import("hono");
    const { createRateLimiter } = await import("../middleware/rate-limit.js");

    const testApp = new Hono();
    testApp.use("*", createRateLimiter({ limit: 100, windowMs: 60_000 }));
    testApp.get("/health", (c) => c.json({ status: "healthy" }));

    const res = await testApp.request("/health");
    expect(res.headers.get("x-ratelimit-limit")).toBeTruthy();
    expect(res.headers.get("x-ratelimit-remaining")).toBeTruthy();
    expect(res.headers.get("x-ratelimit-reset")).toBeTruthy();
  });

  it("all middleware cooperate on a single request", async () => {
    const { Hono } = await import("hono");
    const { createSecureHeaders } = await import("../middleware/secure-headers.js");
    const { createCorsMiddleware } = await import("../middleware/cors.js");
    const { createRateLimiter } = await import("../middleware/rate-limit.js");
    const { requestIdMiddleware } = await import("../middleware/request-id.js");

    const testApp = new Hono();
    testApp.use("*", requestIdMiddleware());
    testApp.use("*", createSecureHeaders());
    testApp.use("*", createCorsMiddleware());
    testApp.use("*", createRateLimiter({ limit: 100, windowMs: 60_000 }));
    testApp.get("/", (c) => c.json({ status: "ok", service: "pluralscape-api" }));

    const res = await testApp.request("/");

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
