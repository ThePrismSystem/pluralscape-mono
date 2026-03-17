import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../../middleware/error-handler.js";
import { requestIdMiddleware } from "../../../middleware/request-id.js";

import type { AuthContext } from "../../../lib/auth-context.js";
import type { ApiErrorResponse } from "@pluralscape/types";
import type { Context } from "hono";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/system.service.js", () => ({
  getSystemProfile: vi.fn(),
}));

vi.mock("../../../services/auth.service.js", () => ({
  extractRequestMeta: vi.fn().mockReturnValue({ ipAddress: null, userAgent: null }),
  extractIpAddress: vi.fn().mockReturnValue(null),
  extractUserAgent: vi.fn().mockReturnValue(null),
}));

vi.mock("../../../lib/db.js", () => ({
  getDb: vi.fn().mockResolvedValue({}),
}));

vi.mock("../../../middleware/rate-limit.js", () => ({
  createCategoryRateLimiter: vi
    .fn()
    .mockImplementation(() => async (_c: Context, next: () => Promise<void>) => {
      await next();
    }),
}));

const MOCK_AUTH: AuthContext = {
  accountId: "acct_test" as AuthContext["accountId"],
  systemId: "sys_test" as AuthContext["systemId"],
  sessionId: "sess_test" as AuthContext["sessionId"],
  accountType: "system",
};

vi.mock("../../../middleware/auth.js", () => ({
  authMiddleware: vi
    .fn()
    .mockImplementation(() => async (c: Context, next: () => Promise<void>) => {
      c.set("auth", MOCK_AUTH);
      await next();
    }),
}));

// ── Imports after mocks ──────────────────────────────────────────

const { getSystemProfile } = await import("../../../services/system.service.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

function createApp(): Hono {
  const app = new Hono();
  app.use("*", requestIdMiddleware());
  app.route("/systems", systemRoutes);
  app.onError(errorHandler);
  return app;
}

// ── Tests ────────────────────────────────────────────────────────

describe("GET /systems/:id", () => {
  beforeEach(() => {
    vi.mocked(getSystemProfile).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with system profile", async () => {
    vi.mocked(getSystemProfile).mockResolvedValueOnce({
      id: "sys_abc" as never,
      encryptedData: "dGVzdA==",
      version: 1,
      createdAt: 1000 as never,
      updatedAt: 1000 as never,
    });

    const app = createApp();
    const res = await app.request("/systems/sys_abc");

    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; encryptedData: string; version: number };
    expect(body.id).toBe("sys_abc");
    expect(body.encryptedData).toBe("dGVzdA==");
    expect(body.version).toBe(1);
  });

  it("forwards systemId and auth to service", async () => {
    vi.mocked(getSystemProfile).mockResolvedValueOnce({
      id: "sys_abc" as never,
      encryptedData: null,
      version: 1,
      createdAt: 1000 as never,
      updatedAt: 1000 as never,
    });

    const app = createApp();
    await app.request("/systems/sys_abc");

    expect(vi.mocked(getSystemProfile)).toHaveBeenCalledWith(
      expect.anything(),
      "sys_abc",
      MOCK_AUTH,
    );
  });

  it("returns 404 when system not found", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(getSystemProfile).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "System not found"),
    );

    const app = createApp();
    const res = await app.request("/systems/sys_nonexistent");

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("re-throws unexpected errors as 500", async () => {
    vi.mocked(getSystemProfile).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await app.request("/systems/sys_abc");

    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
