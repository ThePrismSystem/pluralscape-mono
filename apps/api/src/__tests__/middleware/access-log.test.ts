import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";

import { accessLogMiddleware } from "../../middleware/access-log.js";
import { requestIdMiddleware } from "../../middleware/request-id.js";

const { mockLogInfo } = vi.hoisted(() => ({
  mockLogInfo: vi.fn(),
}));

vi.mock("../../lib/logger.js", () => {
  const instance = {
    info: mockLogInfo,
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
  return {
    logger: instance,
    createRequestLogger: () => instance,
    getContextLogger: () => instance,
  };
});

afterEach(() => {
  mockLogInfo.mockClear();
});

function createApp(): Hono {
  const app = new Hono();
  app.use("*", requestIdMiddleware());
  app.use("*", accessLogMiddleware());
  app.get("/health", (c) => c.json({ status: "healthy" }));
  app.get("/ok", (c) => c.json({ status: "ok" }));
  app.post("/submit", (c) => c.json({ created: true }, 201));
  app.put("/update", (c) => c.json({ updated: true }));
  app.delete("/remove", (c) => c.json({ deleted: true }));
  app.get("/fail", () => {
    throw new Error("Boom");
  });
  app.onError((_, c) => c.json({ error: "Internal Server Error" }, 500));
  return app;
}

describe("accessLogMiddleware", () => {
  it("does not log health check requests", async () => {
    const app = createApp();
    await app.request("/health");
    expect(mockLogInfo).not.toHaveBeenCalled();
  });

  it("logs a successful 200 request with method, path, status, requestId, and duration", async () => {
    const app = createApp();
    await app.request("/ok");

    expect(mockLogInfo).toHaveBeenCalledWith(
      "HTTP request",
      expect.objectContaining({
        requestId: expect.any(String),
        method: "GET",
        path: "/ok",
        status: 200,
        duration: expect.any(Number),
      }),
    );
  });

  it("logs error responses with the error status code", async () => {
    const app = createApp();
    await app.request("/fail");

    expect(mockLogInfo).toHaveBeenCalledWith(
      "HTTP request",
      expect.objectContaining({
        requestId: expect.any(String),
        method: "GET",
        path: "/fail",
        status: 500,
      }),
    );
  });

  it.each([
    { method: "POST", path: "/submit", status: 201 },
    { method: "PUT", path: "/update", status: 200 },
    { method: "DELETE", path: "/remove", status: 200 },
  ])("captures correct HTTP method for $method", async ({ method, path, status }) => {
    const app = createApp();
    await app.request(path, { method });

    expect(mockLogInfo).toHaveBeenCalledWith(
      "HTTP request",
      expect.objectContaining({ method, path, status }),
    );
  });

  it("duration is a non-negative number", async () => {
    const app = createApp();
    await app.request("/ok");

    const call = mockLogInfo.mock.calls.find((c: unknown[]) => c[0] === "HTTP request");
    if (!call) throw new Error("Expected HTTP request log call");
    const data = call[1] as Record<string, unknown>;
    expect(typeof data["duration"]).toBe("number");
    expect(data["duration"]).toBeGreaterThanOrEqual(0);
  });

  it("logs even when no error handler is registered and the handler throws", async () => {
    const app = new Hono();
    app.use("*", requestIdMiddleware());
    app.use("*", accessLogMiddleware());
    app.get("/throw", () => {
      throw new Error("unhandled");
    });

    await app.request("/throw");

    expect(mockLogInfo).toHaveBeenCalledWith(
      "HTTP request",
      expect.objectContaining({
        method: "GET",
        path: "/throw",
        status: 500,
      }),
    );
  });
});
