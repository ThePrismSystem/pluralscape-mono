import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAccountOnlyAuthFactory,
  mockAuditWriterFactory,
  mockDbFactory,
  mockRateLimitFactory,
  mockScopeFactory,
} from "../../../helpers/common-route-mocks.js";
import { MOCK_ACCOUNT_ONLY_AUTH, createRouteApp } from "../../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../../services/friend-code.service.js", () => ({
  generateFriendCode: vi.fn(),
  listFriendCodes: vi.fn(),
  archiveFriendCode: vi.fn(),
  redeemFriendCode: vi.fn(),
}));

vi.mock("../../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../../middleware/auth.js", () => mockAccountOnlyAuthFactory());

vi.mock("../../../../middleware/scope.js", () => mockScopeFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { archiveFriendCode } = await import("../../../../services/friend-code.service.js");
const { createAuditWriter } = await import("../../../../lib/audit-writer.js");
const { accountRoutes } = await import("../../../../routes/account/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/account", accountRoutes);

const CODE_ID = "frc_550e8400-e29b-41d4-a716-446655440000";

// ── Tests ────────────────────────────────────────────────────────

describe("POST /account/friend-codes/:codeId/archive", () => {
  beforeEach(() => {
    vi.mocked(archiveFriendCode).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 204 on success", async () => {
    vi.mocked(archiveFriendCode).mockResolvedValueOnce(undefined);

    const res = await createApp().request(`/account/friend-codes/${CODE_ID}/archive`, {
      method: "POST",
    });

    expect(res.status).toBe(204);
  });

  it("passes correct args to service", async () => {
    vi.mocked(archiveFriendCode).mockResolvedValueOnce(undefined);

    await createApp().request(`/account/friend-codes/${CODE_ID}/archive`, { method: "POST" });

    expect(createAuditWriter).toHaveBeenCalled();
    expect(vi.mocked(archiveFriendCode)).toHaveBeenCalledWith(
      {},
      "acct_test001",
      CODE_ID,
      MOCK_ACCOUNT_ONLY_AUTH,
      expect.any(Function),
    );
  });

  it("returns 400 for invalid codeId format", async () => {
    const res = await createApp().request("/account/friend-codes/not-valid/archive", {
      method: "POST",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
