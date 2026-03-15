import { Hono } from "hono";
import { afterEach, describe, expect, it } from "vitest";

import { corsMiddleware } from "../middleware/cors.js";

describe("corsMiddleware", () => {
  const originalEnv = process.env["CORS_ORIGIN"];

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env["CORS_ORIGIN"];
    } else {
      process.env["CORS_ORIGIN"] = originalEnv;
    }
  });

  function createApp(): Hono {
    const app = new Hono();
    app.use("*", corsMiddleware);
    app.get("/test", (c) => c.json({ ok: true }));
    return app;
  }

  it("returns no CORS headers when CORS_ORIGIN is unset", async () => {
    delete process.env["CORS_ORIGIN"];
    const app = createApp();
    const res = await app.request("/test", {
      headers: { origin: "https://evil.com" },
    });
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("returns CORS headers for allowed origin", async () => {
    process.env["CORS_ORIGIN"] = "https://app.example.com";
    const app = createApp();
    const res = await app.request("/test", {
      headers: { origin: "https://app.example.com" },
    });
    expect(res.headers.get("access-control-allow-origin")).toBe("https://app.example.com");
  });

  it("supports comma-separated origins", async () => {
    process.env["CORS_ORIGIN"] = "https://a.com,https://b.com";
    const app = createApp();

    const resA = await app.request("/test", {
      headers: { origin: "https://a.com" },
    });
    expect(resA.headers.get("access-control-allow-origin")).toBe("https://a.com");

    const resB = await app.request("/test", {
      headers: { origin: "https://b.com" },
    });
    expect(resB.headers.get("access-control-allow-origin")).toBe("https://b.com");
  });

  it("rejects origins not in the allowlist", async () => {
    process.env["CORS_ORIGIN"] = "https://app.example.com";
    const app = createApp();
    const res = await app.request("/test", {
      headers: { origin: "https://evil.com" },
    });
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("handles preflight OPTIONS requests", async () => {
    process.env["CORS_ORIGIN"] = "https://app.example.com";
    const app = createApp();
    const res = await app.request("/test", {
      method: "OPTIONS",
      headers: {
        origin: "https://app.example.com",
        "access-control-request-method": "POST",
      },
    });
    expect(res.status).toBe(204);
  });
});
