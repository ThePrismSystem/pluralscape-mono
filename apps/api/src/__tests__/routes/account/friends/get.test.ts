import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAccountOnlyAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../../helpers/common-route-mocks.js";
import { MOCK_ACCOUNT_ONLY_AUTH, createRouteApp } from "../../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

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
// ── Imports after mocks ──────────────────────────────────────────

const { getFriendConnection } = await import("../../../../services/friend-connection.service.js");
const { accountRoutes } = await import("../../../../routes/account/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/account", accountRoutes);

const CONNECTION_ID = "fc_550e8400-e29b-41d4-a716-446655440000";

const MOCK_CONNECTION = {
  id: CONNECTION_ID as never,
  accountId: "acct_test" as never,
  friendAccountId: "acct_friend" as never,
  status: "accepted" as never,
  encryptedData: null,
  version: 1,
  createdAt: 1000 as never,
  updatedAt: 2000 as never,
};

// ── Tests ────────────────────────────────────────────────────────

describe("GET /account/friends/:connectionId", () => {
  beforeEach(() => {
    vi.mocked(getFriendConnection).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with connection", async () => {
    vi.mocked(getFriendConnection).mockResolvedValueOnce(MOCK_CONNECTION);

    const res = await createApp().request(`/account/friends/${CONNECTION_ID}`);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: typeof MOCK_CONNECTION };
    expect(body.data.id).toBe(CONNECTION_ID);
    expect(body.data.status).toBe("accepted");
  });

  it("passes correct args to service", async () => {
    vi.mocked(getFriendConnection).mockResolvedValueOnce(MOCK_CONNECTION);

    await createApp().request(`/account/friends/${CONNECTION_ID}`);

    expect(vi.mocked(getFriendConnection)).toHaveBeenCalledWith(
      {},
      "acct_test001",
      CONNECTION_ID,
      MOCK_ACCOUNT_ONLY_AUTH,
    );
  });

  it("returns 400 for invalid connectionId format", async () => {
    const res = await createApp().request("/account/friends/not-valid");

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
