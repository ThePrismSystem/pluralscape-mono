import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../../middleware/error-handler.js";
import { requestIdMiddleware } from "../../../middleware/request-id.js";

import type { AuthContext } from "../../../lib/auth-context.js";
import type { ApiErrorResponse } from "@pluralscape/types";
import type { Context } from "hono";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/system.service.js", () => ({
  createSystem: vi.fn(),
}));

vi.mock("../../../services/auth.service.js", () => ({
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

const { createSystem } = await import("../../../services/system.service.js");
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

describe("POST /systems", () => {
  beforeEach(() => {
    vi.mocked(createSystem).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 201 with new system on success", async () => {
    vi.mocked(createSystem).mockResolvedValueOnce({
      id: "sys_new",
      encryptedData: null,
      version: 1,
      createdAt: 1000,
      updatedAt: 1000,
    });

    const app = createApp();
    const res = await app.request("/systems", { method: "POST" });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string; encryptedData: null; version: number };
    expect(body.id).toBe("sys_new");
    expect(body.encryptedData).toBeNull();
    expect(body.version).toBe(1);
  });

  it("returns 403 when account type is not system", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(createSystem).mockRejectedValueOnce(
      new ApiHttpError(403, "FORBIDDEN", "Only system accounts can create systems"),
    );

    const app = createApp();
    const res = await app.request("/systems", { method: "POST" });

    expect(res.status).toBe(403);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("FORBIDDEN");
  });
});
