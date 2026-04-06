import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createSecureHeaders } from "../middleware/secure-headers.js";

const mockEnv = vi.hoisted(() => ({
  NODE_ENV: "test" as "development" | "test" | "production",
}));

vi.mock("../env.js", () => ({ env: mockEnv }));

describe("secureHeaders middleware", () => {
  afterEach(() => {
    mockEnv.NODE_ENV = "test";
  });

  function createApp(): Hono {
    const app = new Hono();
    app.use("*", createSecureHeaders());
    app.get("/test", (c) => c.json({ ok: true }));
    return app;
  }

  it("sets X-Content-Type-Options to nosniff", async () => {
    const app = createApp();
    const res = await app.request("/test");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("sets X-Frame-Options to DENY", async () => {
    const app = createApp();
    const res = await app.request("/test");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
  });

  it("sets Content-Security-Policy with default-src self", async () => {
    const app = createApp();
    const res = await app.request("/test");
    const csp = res.headers.get("content-security-policy");
    expect(csp).toContain("default-src 'none'");
  });

  it("sets Content-Security-Policy with frame-ancestors none", async () => {
    const app = createApp();
    const res = await app.request("/test");
    const csp = res.headers.get("content-security-policy");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("sets Strict-Transport-Security in production", async () => {
    mockEnv.NODE_ENV = "production";
    const app = createApp();
    const res = await app.request("/test");
    expect(res.headers.get("strict-transport-security")).toBe(
      "max-age=63072000; includeSubDomains; preload",
    );
  });

  it("does not set HSTS in development", async () => {
    mockEnv.NODE_ENV = "development";
    const app = createApp();
    const res = await app.request("/test");
    expect(res.headers.get("strict-transport-security")).toBeNull();
  });

  it("sets Referrer-Policy header", async () => {
    const app = createApp();
    const res = await app.request("/test");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
  });

  it("sets Permissions-Policy header restricting browser APIs", async () => {
    const app = createApp();
    const res = await app.request("/test");
    const pp = res.headers.get("permissions-policy");
    expect(pp).toContain("camera=()");
    expect(pp).toContain("microphone=()");
    expect(pp).toContain("geolocation=()");
  });

  it("does not interfere with response body", async () => {
    const app = createApp();
    const res = await app.request("/test");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });
});
