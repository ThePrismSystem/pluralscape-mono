import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAccountOnlyAuthFactory,
  mockAuditWriterFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../../helpers/common-route-mocks.js";
import { MOCK_ACCOUNT_ONLY_AUTH, createRouteApp } from "../../../helpers/route-test-setup.js";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../../services/account/friend-codes/generate.js", () => ({
  generateFriendCode: vi.fn(),
}));
vi.mock("../../../../services/account/friend-codes/list.js", () => ({
  listFriendCodes: vi.fn(),
}));
vi.mock("../../../../services/account/friend-codes/archive.js", () => ({
  archiveFriendCode: vi.fn(),
}));
vi.mock("../../../../services/account/friend-codes/redeem.js", () => ({
  redeemFriendCode: vi.fn(),
}));

vi.mock("../../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../../middleware/auth.js", () => mockAccountOnlyAuthFactory());
// ── Imports after mocks ──────────────────────────────────────────

const { generateFriendCode } = await import(
  "../../../../services/account/friend-codes/generate.js"
);
const { createAuditWriter } = await import("../../../../lib/audit-writer.js");
const { accountRoutes } = await import("../../../../routes/account/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/account", accountRoutes);

const MOCK_CODE = {
  id: "frc_550e8400-e29b-41d4-a716-446655440000" as never,
  accountId: "acct_test" as never,
  code: "ABCD-1234",
  createdAt: 1000 as never,
  expiresAt: null,
  archived: false,
};

// ── Tests ────────────────────────────────────────────────────────

describe("POST /account/friend-codes", () => {
  beforeEach(() => {
    vi.mocked(generateFriendCode).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 201 with new friend code", async () => {
    vi.mocked(generateFriendCode).mockResolvedValueOnce(MOCK_CODE);

    const res = await createApp().request("/account/friend-codes", { method: "POST" });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: typeof MOCK_CODE };
    expect(body.data.id).toBe(MOCK_CODE.id);
    expect(body.data.code).toBe("ABCD-1234");
  });

  it("passes correct args to service", async () => {
    vi.mocked(generateFriendCode).mockResolvedValueOnce(MOCK_CODE);

    await createApp().request("/account/friend-codes", { method: "POST" });

    expect(createAuditWriter).toHaveBeenCalled();
    expect(vi.mocked(generateFriendCode)).toHaveBeenCalledWith(
      {},
      "acct_test001",
      MOCK_ACCOUNT_ONLY_AUTH,
      expect.any(Function),
    );
  });
});
