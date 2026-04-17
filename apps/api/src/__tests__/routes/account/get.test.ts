import { toUnixMillis, brandId } from "@pluralscape/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../helpers/common-route-mocks.js";
import { createRouteApp } from "../../helpers/route-test-setup.js";

import type { AccountId, AccountType, ApiErrorResponse, SystemId } from "@pluralscape/types";

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
      accountId: brandId<AccountId>("acct_test001"),
      accountType: "system" as AccountType,
      systemId: brandId<SystemId>("sys_test"),
      auditLogIpTracking: false,
      version: 1,
      createdAt: toUnixMillis(1000),
      updatedAt: toUnixMillis(2000),
    };
    vi.mocked(getAccountInfo).mockResolvedValueOnce(mockInfo);

    const app = createApp();
    const res = await app.request("/account");

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: typeof mockInfo };
    expect(body.data.accountId).toBe("acct_test001");
    expect(body.data.accountType).toBe("system");
    expect(body.data.systemId).toBe("sys_test");
    expect(vi.mocked(getAccountInfo)).toHaveBeenCalledWith({}, "acct_test001");
  });

  it("returns 404 when account is not found", async () => {
    vi.mocked(getAccountInfo).mockResolvedValueOnce(null);

    const app = createApp();
    const res = await app.request("/account");

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  describe("Cache-Control", () => {
    it("sets Cache-Control: no-store on successful response", async () => {
      vi.mocked(getAccountInfo).mockResolvedValueOnce({
        accountId: brandId<AccountId>("acct_cc"),
        accountType: "system" as AccountType,
        systemId: null,
        auditLogIpTracking: false,
        version: 1,
        createdAt: toUnixMillis(1000),
        updatedAt: toUnixMillis(1000),
      });

      const app = createApp();
      const res = await app.request("/account");

      expect(res.headers.get("Cache-Control")).toBe("no-store");
    });
  });
});
