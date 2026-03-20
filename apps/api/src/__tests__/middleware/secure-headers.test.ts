import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HSTS_MAX_AGE_SECONDS } from "../../middleware/middleware.constants.js";
import { createSecureHeaders } from "../../middleware/secure-headers.js";

const mockEnv = vi.hoisted(() => ({
  NODE_ENV: "test" as "development" | "test" | "production",
}));

vi.mock("../../env.js", () => ({ env: mockEnv }));

// ── Helpers ──────────────────────────────────────────────────────────

function createApp(): Hono {
  const app = new Hono();
  app.use("*", createSecureHeaders());
  app.get("/test", (c) => c.json({ ok: true }));
  return app;
}

// ── Tests ────────────────────────────────────────────────────────────

describe("createSecureHeaders", () => {
  afterEach(() => {
    mockEnv.NODE_ENV = "test";
  });

  it("sets Content-Security-Policy header", async () => {
    const app = createApp();
    const res = await app.request("/test");

    expect(res.status).toBe(200);
    const csp = res.headers.get("Content-Security-Policy");
    expect(csp).toBeDefined();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("sets X-Frame-Options to DENY", async () => {
    const app = createApp();
    const res = await app.request("/test");

    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
  });

  describe("HSTS in production", () => {
    it("sets Strict-Transport-Security with max-age, includeSubDomains, and preload", async () => {
      mockEnv.NODE_ENV = "production";
      const app = createApp();

      const res = await app.request("/test");
      const hsts = res.headers.get("Strict-Transport-Security");

      expect(hsts).toBeDefined();
      expect(hsts).toContain(`max-age=${String(HSTS_MAX_AGE_SECONDS)}`);
      expect(hsts).toContain("includeSubDomains");
      expect(hsts).toContain("preload");
    });
  });

  describe("HSTS in non-production", () => {
    it("does not set Strict-Transport-Security when NODE_ENV is not production", async () => {
      mockEnv.NODE_ENV = "development";
      const app = createApp();

      const res = await app.request("/test");
      const hsts = res.headers.get("Strict-Transport-Security");

      expect(hsts).toBeNull();
    });
  });
});
