import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAccountOnlyAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../../helpers/common-route-mocks.js";
import { MOCK_ACCOUNT_ONLY_AUTH, createRouteApp } from "../../../helpers/route-test-setup.js";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../../services/friend-code.service.js", () => ({
  generateFriendCode: vi.fn(),
  listFriendCodes: vi.fn(),
  archiveFriendCode: vi.fn(),
  redeemFriendCode: vi.fn(),
}));

vi.mock("../../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../../middleware/auth.js", () => mockAccountOnlyAuthFactory());
// ── Imports after mocks ──────────────────────────────────────────

const { listFriendCodes } = await import("../../../../services/friend-code.service.js");
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

const MOCK_PAGINATED = {
  data: [MOCK_CODE],
  nextCursor: null,
  hasMore: false,
  totalCount: null,
};

const EMPTY_PAGE = {
  data: [],
  nextCursor: null,
  hasMore: false,
  totalCount: null,
};

describe("GET /account/friend-codes", () => {
  beforeEach(() => {
    vi.mocked(listFriendCodes).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with paginated result", async () => {
    vi.mocked(listFriendCodes).mockResolvedValueOnce(MOCK_PAGINATED);

    const res = await createApp().request("/account/friend-codes");

    expect(res.status).toBe(200);
    const body = (await res.json()) as typeof MOCK_PAGINATED;
    expect(body.data).toHaveLength(1);
    expect(body.data[0]?.id).toBe(MOCK_CODE.id);
    expect(body.data[0]?.code).toBe("ABCD-1234");
  });

  it("returns empty items when no codes exist", async () => {
    vi.mocked(listFriendCodes).mockResolvedValueOnce(EMPTY_PAGE);

    const res = await createApp().request("/account/friend-codes");

    expect(res.status).toBe(200);
    const body = (await res.json()) as typeof EMPTY_PAGE;
    expect(body.data).toEqual([]);
  });

  it("passes correct args to service", async () => {
    vi.mocked(listFriendCodes).mockResolvedValueOnce(EMPTY_PAGE);

    await createApp().request("/account/friend-codes");

    expect(vi.mocked(listFriendCodes)).toHaveBeenCalledWith(
      {},
      "acct_test001",
      MOCK_ACCOUNT_ONLY_AUTH,
      undefined,
      expect.any(Number),
    );
  });
});
