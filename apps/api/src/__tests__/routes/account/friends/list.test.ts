import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAccountOnlyAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
  mockScopeFactory,
} from "../../../helpers/common-route-mocks.js";
import { MOCK_ACCOUNT_ONLY_AUTH, createRouteApp } from "../../../helpers/route-test-setup.js";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../../services/friend-connection.service.js", () => ({
  acceptFriendConnection: vi.fn(),
  archiveFriendConnection: vi.fn(),
  blockFriendConnection: vi.fn(),
  getFriendConnection: vi.fn(),
  listFriendConnections: vi.fn(),
  rejectFriendConnection: vi.fn(),
  removeFriendConnection: vi.fn(),
  restoreFriendConnection: vi.fn(),
  updateFriendVisibility: vi.fn(),
}));

vi.mock("../../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../../middleware/auth.js", () => mockAccountOnlyAuthFactory());

vi.mock("../../../../middleware/scope.js", () => mockScopeFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { listFriendConnections } = await import("../../../../services/friend-connection.service.js");
const { accountRoutes } = await import("../../../../routes/account/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/account", accountRoutes);

const MOCK_PAGINATED_RESULT = {
  data: [] as never[],
  nextCursor: null,
  hasMore: false,
  totalCount: 0,
};

// ── Tests ────────────────────────────────────────────────────────

describe("GET /account/friends", () => {
  beforeEach(() => {
    vi.mocked(listFriendConnections).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with paginated results", async () => {
    vi.mocked(listFriendConnections).mockResolvedValueOnce(MOCK_PAGINATED_RESULT);

    const res = await createApp().request("/account/friends");

    expect(res.status).toBe(200);
    const body = (await res.json()) as typeof MOCK_PAGINATED_RESULT;
    expect(body.data).toEqual([]);
    expect(body.hasMore).toBe(false);
  });

  it("passes query params to service", async () => {
    vi.mocked(listFriendConnections).mockResolvedValueOnce(MOCK_PAGINATED_RESULT);

    await createApp().request("/account/friends?cursor=abc&limit=10&includeArchived=true");

    expect(vi.mocked(listFriendConnections)).toHaveBeenCalledWith(
      {},
      "acct_test001",
      MOCK_ACCOUNT_ONLY_AUTH,
      { cursor: "abc", limit: 10, includeArchived: true },
    );
  });

  it("defaults includeArchived to false", async () => {
    vi.mocked(listFriendConnections).mockResolvedValueOnce(MOCK_PAGINATED_RESULT);

    await createApp().request("/account/friends");

    expect(vi.mocked(listFriendConnections)).toHaveBeenCalledWith(
      {},
      "acct_test001",
      MOCK_ACCOUNT_ONLY_AUTH,
      { cursor: undefined, limit: 25, includeArchived: false },
    );
  });
});
