import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../helpers/common-route-mocks.js";
import { createRouteApp } from "../../helpers/route-test-setup.js";

import type {
  AccountId,
  AccountType,
  ApiErrorResponse,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/account.service.js", () => ({
  getAccountInfo: vi.fn(),
}));

vi.mock("../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { getAccountInfo } = await import("../../../services/account.service.js");
const { accountRoutes } = await import("../../../routes/account/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/account", accountRoutes);

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
      accountId: "acct_test" as AccountId,
      accountType: "system" as AccountType,
      systemId: "sys_test" as SystemId,
      createdAt: 1000 as UnixMillis,
      updatedAt: 2000 as UnixMillis,
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
