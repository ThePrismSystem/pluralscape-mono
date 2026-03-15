import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { afterEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../middleware/error-handler.js";

describe("errorHandler", () => {
  const originalEnv = process.env["NODE_ENV"];

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env["NODE_ENV"];
    } else {
      process.env["NODE_ENV"] = originalEnv;
    }
    vi.restoreAllMocks();
  });

  function createApp(): Hono {
    const app = new Hono();
    app.onError(errorHandler);
    app.get("/fail", () => {
      throw new Error("Something broke");
    });
    app.get("/forbidden", () => {
      throw new HTTPException(403, { message: "Forbidden" });
    });
    app.get("/server-error", () => {
      throw new HTTPException(500, { message: "Internal failure" });
    });
    app.get("/ok", (c) => c.json({ ok: true }));
    return app;
  }

  it("returns 500 for unhandled errors", async () => {
    const app = createApp();
    const res = await app.request("/fail");
    expect(res.status).toBe(500);
  });

  it("returns generic error message in production", async () => {
    process.env["NODE_ENV"] = "production";
    const app = createApp();
    const res = await app.request("/fail");
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Internal Server Error");
    expect(JSON.stringify(body)).not.toContain("Something broke");
  });

  it("includes error message in development", async () => {
    process.env["NODE_ENV"] = "development";
    const app = createApp();
    const res = await app.request("/fail");
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Something broke");
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

  it("preserves HTTPException status code (e.g., 403)", async () => {
    const app = createApp();
    const res = await app.request("/forbidden");
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Forbidden");
  });

  it("preserves HTTPException message in development", async () => {
    process.env["NODE_ENV"] = "development";
    const app = createApp();
    const res = await app.request("/forbidden");
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Forbidden");
  });

  it("returns generic message for HTTPException 500+ in production", async () => {
    process.env["NODE_ENV"] = "production";
    const app = createApp();
    const res = await app.request("/server-error");
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Internal Server Error");
  });

  it("logs unhandled errors via console.error", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const app = createApp();
    await app.request("/fail");
    expect(spy).toHaveBeenCalledWith("[api] Unhandled error:", expect.any(Error));
  });

  it("does not log HTTPException 4xx errors", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const app = createApp();
    await app.request("/forbidden");
    expect(spy).not.toHaveBeenCalled();
  });

  it("logs HTTPException 5xx errors", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const app = createApp();
    await app.request("/server-error");
    expect(spy).toHaveBeenCalledWith("[api] Unhandled error:", expect.any(HTTPException));
  });
});
