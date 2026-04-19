import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the Bun-specific WebSocket adapter (not available in Node.js/Vitest)
// and the Hono/Bun connInfo helper — same pattern as v1-routing.test.ts.
vi.mock("../../../ws/bun-adapter.js", () => ({
  upgradeWebSocket: vi.fn(() => vi.fn()),
  websocket: { open: vi.fn(), close: vi.fn(), message: vi.fn() },
}));

vi.mock("hono/bun", () => ({
  getConnInfo: vi.fn(() => ({ remote: { address: "127.0.0.1" } })),
}));

const { app } = await import("../../../index.js");
const { _resetI18nDepsForTesting } = await import("../../../services/i18n-deps.js");

describe("v1 i18n route mounting", () => {
  beforeEach(() => {
    _resetI18nDepsForTesting();
  });

  it("mounts /v1/i18n/manifest (returns non-404)", async () => {
    const res = await app.request("/v1/i18n/manifest");
    // Without the shared Valkey client + hash, the handler returns 503 NOT_CONFIGURED.
    // With them wired, it would return 200 or 502. Anything but 404 proves the mount.
    expect(res.status).not.toBe(404);
  });

  it("returns 503 NOT_CONFIGURED when deps are missing", async () => {
    const res = await app.request("/v1/i18n/manifest");
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("NOT_CONFIGURED");
  });

  it("returns 503 NOT_CONFIGURED for namespace route when deps are missing", async () => {
    const res = await app.request("/v1/i18n/es/common");
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("NOT_CONFIGURED");
  });

  it("exposes the i18nFetch rate-limit headers", async () => {
    const res = await app.request("/v1/i18n/manifest");
    // RATE_LIMITS.i18nFetch.limit === 30. The category key-prefix means this
    // header value is set by the createCategoryRateLimiter middleware that
    // wraps the i18n sub-app, independent of the 503/200 response path.
    expect(res.headers.get("x-ratelimit-limit")).toBe("30");
  });
});

describe("v1 i18n route mounting — production path", () => {
  beforeEach(() => {
    _resetI18nDepsForTesting();
  });

  it("dispatches /v1/i18n/:locale/:namespace to the namespace handler (not 404)", async () => {
    // Once handlers are migrated, this path should return 503 because deps
    // aren't wired in this test — but crucially NOT 404, which is what the
    // broken sub-app dispatch produces in production. This regression test
    // guards the dispatch path from reverting to nested `app.route()` mounts.
    const res = await app.request("/v1/i18n/en/common");
    expect(res.status).not.toBe(404);
  });
});
