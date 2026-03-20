import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createCorsMiddleware } from "../middleware/cors.js";

const mockEnv = vi.hoisted(() => ({
  CORS_ORIGIN: undefined as string | undefined,
}));

vi.mock("../env.js", () => ({ env: mockEnv }));

describe("corsMiddleware", () => {
  afterEach(() => {
    mockEnv.CORS_ORIGIN = undefined;
  });

  function createApp(): Hono {
    const app = new Hono();
    app.use("*", createCorsMiddleware());
    app.get("/test", (c) => c.json({ ok: true }));
    return app;
  }

  it("returns no CORS headers when CORS_ORIGIN is unset", async () => {
    mockEnv.CORS_ORIGIN = undefined;
    const app = createApp();
    const res = await app.request("/test", {
      headers: { origin: "https://evil.com" },
    });
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("returns CORS headers for allowed origin", async () => {
    mockEnv.CORS_ORIGIN = "https://app.example.com";
    const app = createApp();
    const res = await app.request("/test", {
      headers: { origin: "https://app.example.com" },
    });
    expect(res.headers.get("access-control-allow-origin")).toBe("https://app.example.com");
  });

  it("supports comma-separated origins", async () => {
    mockEnv.CORS_ORIGIN = "https://a.com,https://b.com";
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
    mockEnv.CORS_ORIGIN = "https://app.example.com";
    const app = createApp();
    const res = await app.request("/test", {
      headers: { origin: "https://evil.com" },
    });
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("handles preflight OPTIONS requests", async () => {
    mockEnv.CORS_ORIGIN = "https://app.example.com";
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

  it("ignores blank entries in CORS_ORIGIN (trailing commas, whitespace-only)", async () => {
    mockEnv.CORS_ORIGIN = "https://app.example.com,,  ,";
    const app = createApp();

    const res = await app.request("/test", {
      headers: { origin: "https://app.example.com" },
    });
    expect(res.headers.get("access-control-allow-origin")).toBe("https://app.example.com");
  });

  it("all-whitespace CORS_ORIGIN returns no CORS headers", async () => {
    mockEnv.CORS_ORIGIN = "   ,  , ";
    const app = createApp();
    const res = await app.request("/test", {
      headers: { origin: "https://evil.com" },
    });
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("preflight includes Access-Control-Allow-Methods and Allow-Headers", async () => {
    mockEnv.CORS_ORIGIN = "https://app.example.com";
    const app = createApp();
    const res = await app.request("/test", {
      method: "OPTIONS",
      headers: {
        origin: "https://app.example.com",
        "access-control-request-method": "POST",
      },
    });
    expect(res.headers.get("access-control-allow-methods")).toBeTruthy();
    expect(res.headers.get("access-control-allow-headers")).toBeTruthy();
  });

  it("includes Vary: Origin for dynamic origin allowlist", async () => {
    mockEnv.CORS_ORIGIN = "https://a.com,https://b.com";
    const app = createApp();
    const res = await app.request("/test", {
      headers: { origin: "https://a.com" },
    });
    const vary = res.headers.get("vary");
    expect(vary).toContain("Origin");
  });
});
