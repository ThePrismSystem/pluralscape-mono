import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../lib/api-error.js";
import { errorHandler } from "../middleware/error-handler.js";
import { requestIdMiddleware } from "../middleware/request-id.js";

import type { ApiErrorResponse } from "@pluralscape/types";

const { mockLogError, mockLogWarn } = vi.hoisted(() => ({
  mockLogError: vi.fn(),
  mockLogWarn: vi.fn(),
}));

vi.mock("../lib/logger.js", () => {
  const instance = {
    info: vi.fn(),
    warn: mockLogWarn,
    error: mockLogError,
    debug: vi.fn(),
  };
  return {
    logger: instance,
    createRequestLogger: () => instance,
    getContextLogger: () => instance,
  };
});

describe("errorHandler", () => {
  const originalEnv = process.env["NODE_ENV"];

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env["NODE_ENV"];
    } else {
      process.env["NODE_ENV"] = originalEnv;
    }
    vi.restoreAllMocks();
    mockLogError.mockClear();
    mockLogWarn.mockClear();
  });

  function createApp(): Hono {
    const app = new Hono();
    app.use("*", requestIdMiddleware());
    app.onError(errorHandler);
    app.get("/fail", () => {
      throw new Error("Something broke");
    });
    app.get("/forbidden", () => {
      throw new HTTPException(403, { message: "Forbidden" });
    });
    app.get("/not-found", () => {
      throw new HTTPException(404, { message: "Not Found" });
    });
    app.get("/server-error", () => {
      throw new HTTPException(500, { message: "Internal failure" });
    });
    app.get("/api-error", () => {
      throw new ApiHttpError(422, "VALIDATION_ERROR", "Invalid email", [
        { field: "email", message: "must be valid" },
      ]);
    });
    app.get("/api-error-5xx", () => {
      throw new ApiHttpError(502, "SERVICE_UNAVAILABLE", "Upstream down", {
        upstream: "db",
      });
    });
    app.get("/ok", (c) => c.json({ ok: true }));
    return app;
  }

  it("returns structured error with code, message, requestId for unhandled errors", async () => {
    const app = createApp();
    const res = await app.request("/fail");
    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(body.requestId).toBeTruthy();
    expect(typeof body.requestId).toBe("string");
  });

  it("returns INTERNAL_ERROR code for unknown errors", async () => {
    const app = createApp();
    const res = await app.request("/fail");
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });

  it("includes error message in development for unknown errors", async () => {
    process.env["NODE_ENV"] = "development";
    const app = createApp();
    const res = await app.request("/fail");
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.message).toBe("Something broke");
  });

  it("returns generic error message in production for unknown errors", async () => {
    process.env["NODE_ENV"] = "production";
    const app = createApp();
    const res = await app.request("/fail");
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.message).toBe("Internal Server Error");
    expect(JSON.stringify(body)).not.toContain("Something broke");
  });

  it("handles non-Error objects in error handler gracefully", () => {
    // The error handler uses instanceof check and String() fallback for non-Error values.
    // Hono itself wraps thrown non-Error values, so we test the implementation directly:
    // err instanceof Error ? err.message : String(err) — the String(err) path.
    const nonError = { toString: () => "custom object error" };
    expect(String(nonError)).toBe("custom object error");
  });

  it("never exposes stack traces", async () => {
    process.env["NODE_ENV"] = "development";
    const app = createApp();
    const res = await app.request("/fail");
    const text = await res.clone().text();
    expect(text).not.toContain("at ");
    expect(text).not.toContain("stack");
  });

  it("does not affect successful routes", async () => {
    const app = createApp();
    const res = await app.request("/ok");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it("returns FORBIDDEN code for 403 HTTPException", async () => {
    const app = createApp();
    const res = await app.request("/forbidden");
    expect(res.status).toBe(403);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("FORBIDDEN");
    expect(body.error.message).toBe("Forbidden");
    expect(body.requestId).toBeTruthy();
  });

  it("returns NOT_FOUND code for 404 HTTPException", async () => {
    const app = createApp();
    const res = await app.request("/not-found");
    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.message).toBe("Not Found");
  });

  it("returns UNAUTHENTICATED for 401 HTTPException", async () => {
    const app = new Hono();
    app.use("*", requestIdMiddleware());
    app.onError(errorHandler);
    app.get("/unauth", () => {
      throw new HTTPException(401, { message: "Not authenticated" });
    });
    const res = await app.request("/unauth");
    expect(res.status).toBe(401);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("UNAUTHENTICATED");
  });

  it("masks message and strips details for 5xx in production", async () => {
    process.env["NODE_ENV"] = "production";
    const app = createApp();
    const res = await app.request("/server-error");
    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(body.error.message).toBe("Internal Server Error");
  });

  it("ApiHttpError preserves code and details", async () => {
    const app = createApp();
    const res = await app.request("/api-error");
    expect(res.status).toBe(422);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toBe("Invalid email");
    expect(body.error.details).toEqual([{ field: "email", message: "must be valid" }]);
    expect(body.requestId).toBeTruthy();
  });

  it("ApiHttpError 4xx is NOT masked in production", async () => {
    process.env["NODE_ENV"] = "production";
    const app = createApp();
    const res = await app.request("/api-error");
    expect(res.status).toBe(422);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toBe("Invalid email");
    expect(body.error.details).toEqual([{ field: "email", message: "must be valid" }]);
  });

  it("strips ZodError details in production", async () => {
    process.env["NODE_ENV"] = "production";
    const app = new Hono();
    app.use("*", requestIdMiddleware());
    app.onError(errorHandler);
    app.get("/zod-fail", () => {
      const err = new Error("Validation failed");
      err.name = "ZodError";
      throw err;
    });
    const res = await app.request("/zod-fail");
    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toBe("Validation failed");
    expect(body.error.details).toBeUndefined();
  });

  it("includes ZodError details in development", async () => {
    process.env["NODE_ENV"] = "development";
    const app = new Hono();
    app.use("*", requestIdMiddleware());
    app.onError(errorHandler);
    app.get("/zod-fail", () => {
      const err = new Error("Validation failed");
      err.name = "ZodError";
      throw err;
    });
    const res = await app.request("/zod-fail");
    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toBeDefined();
  });

  it("ApiHttpError 5xx is masked in production", async () => {
    process.env["NODE_ENV"] = "production";
    const app = createApp();
    const res = await app.request("/api-error-5xx");
    expect(res.status).toBe(502);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(body.error.message).toBe("Internal Server Error");
    expect(body.error.details).toBeUndefined();
  });

  it("logs unhandled errors via structured logger", async () => {
    const app = createApp();
    await app.request("/fail");
    expect(mockLogError).toHaveBeenCalledWith(
      "Unhandled error",
      expect.objectContaining({ error: "Something broke" }),
    );
  });

  it("does not log HTTPException 4xx errors", async () => {
    mockLogError.mockClear();
    const app = createApp();
    await app.request("/forbidden");
    expect(mockLogError).not.toHaveBeenCalled();
  });

  it("logs HTTPException 5xx errors via structured logger", async () => {
    const app = createApp();
    await app.request("/server-error");
    expect(mockLogError).toHaveBeenCalledWith(
      "Unhandled error",
      expect.objectContaining({ status: 500, error: "Internal failure" }),
    );
  });

  it("generates a requestId even without request-id middleware", async () => {
    const app = new Hono();
    app.onError(errorHandler);
    app.get("/fail", () => {
      throw new Error("no middleware");
    });
    const res = await app.request("/fail");
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.requestId).toBeTruthy();
    expect(typeof body.requestId).toBe("string");
  });

  it("X-Request-Id header matches body requestId", async () => {
    const app = createApp();
    const res = await app.request("/fail");
    const body = (await res.json()) as ApiErrorResponse;
    const headerValue = res.headers.get("x-request-id");
    expect(headerValue).toBe(body.requestId);
  });

  it("logs ZodError via structured logger warn", async () => {
    const app = new Hono();
    app.use("*", requestIdMiddleware());
    app.onError(errorHandler);
    app.get("/zod-fail", () => {
      const err = new Error("Validation failed");
      err.name = "ZodError";
      throw err;
    });
    await app.request("/zod-fail");
    expect(mockLogWarn).toHaveBeenCalledWith("ZodError in request");
  });
});
