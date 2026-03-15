import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import { secureHeaders } from "../middleware/secure-headers.js";

describe("secureHeaders middleware", () => {
  function createApp(): Hono {
    const app = new Hono();
    app.use("*", secureHeaders);
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
    expect(csp).toContain("default-src 'self'");
  });

  it("sets Content-Security-Policy with frame-ancestors none", async () => {
    const app = createApp();
    const res = await app.request("/test");
    const csp = res.headers.get("content-security-policy");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("sets Strict-Transport-Security", async () => {
    const app = createApp();
    const res = await app.request("/test");
    expect(res.headers.get("strict-transport-security")).toBeTruthy();
  });

  it("does not interfere with response body", async () => {
    const app = createApp();
    const res = await app.request("/test");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });
});
