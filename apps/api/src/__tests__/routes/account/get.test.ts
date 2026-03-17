import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../../middleware/error-handler.js";
import { requestIdMiddleware } from "../../../middleware/request-id.js";

import type { AccountType, ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/account.service.js", () => ({
  getAccountInfo: vi.fn(),
}));

vi.mock("../../../lib/db.js", () => ({
  getDb: vi.fn().mockResolvedValue({}),
}));

vi.mock("../../../middleware/rate-limit.js", () => ({
  createCategoryRateLimiter: vi
    .fn()
    .mockImplementation(() => async (_c: unknown, next: () => Promise<void>) => {
      await next();
    }),
}));

vi.mock("../../../middleware/auth.js", () => ({
  authMiddleware: vi
    .fn()
    .mockImplementation(
      () =>
        async (c: { set: (key: string, value: unknown) => void }, next: () => Promise<void>) => {
          c.set("auth", {
            accountId: "acct_test",
            sessionId: "sess_current",
            systemId: "sys_test",
            accountType: "system",
          });
          await next();
        },
    ),
}));

// ── Imports after mocks ──────────────────────────────────────────

const { getAccountInfo } = await import("../../../services/account.service.js");
const { accountRoutes } = await import("../../../routes/account/index.js");

// ── Helpers ──────────────────────────────────────────────────────

function createApp(): Hono {
  const app = new Hono();
  app.use("*", requestIdMiddleware());
  app.route("/account", accountRoutes);
  app.onError(errorHandler);
  return app;
}

// ── Tests ────────────────────────────────────────────────────────

describe("GET /account", () => {
  beforeEach(() => {
    vi.mocked(getAccountInfo).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns account info for authenticated user", async () => {
    const mockInfo = {
      accountId: "acct_test",
      accountType: "system" as AccountType,
      systemId: "sys_test",
      createdAt: 1000,
      updatedAt: 2000,
    };
    vi.mocked(getAccountInfo).mockResolvedValueOnce(mockInfo);

    const app = createApp();
    const res = await app.request("/account");

    expect(res.status).toBe(200);
    const body = (await res.json()) as typeof mockInfo;
    expect(body.accountId).toBe("acct_test");
    expect(body.accountType).toBe("system");
    expect(body.systemId).toBe("sys_test");
    expect(vi.mocked(getAccountInfo)).toHaveBeenCalledWith({}, "acct_test");
  });

  it("returns 404 when account is not found", async () => {
    vi.mocked(getAccountInfo).mockResolvedValueOnce(null);

    const app = createApp();
    const res = await app.request("/account");

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });
});
