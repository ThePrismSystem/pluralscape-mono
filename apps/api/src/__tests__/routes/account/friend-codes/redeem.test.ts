import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAccountOnlyAuthFactory,
  mockAuditWriterFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../../helpers/common-route-mocks.js";
import { MOCK_ACCOUNT_ONLY_AUTH, createRouteApp } from "../../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

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

const { redeemFriendCode } = await import(
  "../../../../services/account/friend-codes/redeem.js"
);
const { createAuditWriter } = await import("../../../../lib/audit-writer.js");
const { createCategoryRateLimiter } = await import("../../../../middleware/rate-limit.js");
const { accountRoutes } = await import("../../../../routes/account/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/account", accountRoutes);

const MOCK_REDEEM_RESULT = {
  connectionIds: [
    "fc_550e8400-e29b-41d4-a716-446655440000" as never,
    "fc_660e8400-e29b-41d4-a716-446655440000" as never,
  ] as const,
};

// ── Tests ────────────────────────────────────────────────────────

describe("POST /account/friend-codes/redeem", () => {
  beforeEach(() => {
    vi.mocked(redeemFriendCode).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses friendCodeRedeem rate limit category", () => {
    expect(vi.mocked(createCategoryRateLimiter)).toHaveBeenCalledWith("friendCodeRedeem");
  });

  it("returns 201 with connection IDs", async () => {
    vi.mocked(redeemFriendCode).mockResolvedValueOnce(MOCK_REDEEM_RESULT);

    const res = await createApp().request("/account/friend-codes/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "ABCD-1234" }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: typeof MOCK_REDEEM_RESULT };
    expect(body.data.connectionIds).toHaveLength(2);
  });

  it("passes code and auth to service", async () => {
    vi.mocked(redeemFriendCode).mockResolvedValueOnce(MOCK_REDEEM_RESULT);

    await createApp().request("/account/friend-codes/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "ABCD-1234" }),
    });

    expect(createAuditWriter).toHaveBeenCalled();
    expect(vi.mocked(redeemFriendCode)).toHaveBeenCalledWith(
      {},
      "ABCD-1234",
      MOCK_ACCOUNT_ONLY_AUTH,
      expect.any(Function),
    );
  });

  it("returns 400 for malformed JSON body", async () => {
    const res = await createApp().request("/account/friend-codes/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{{{",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
