import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../../../lib/api-error.js";
import {
  mockAccountOnlyAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../../helpers/common-route-mocks.js";
import { MOCK_ACCOUNT_ONLY_AUTH, createRouteApp } from "../../../helpers/route-test-setup.js";

import type { ApiErrorResponse, FriendDashboardResponse, SystemId } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../../services/friend-dashboard.service.js", () => ({
  getFriendDashboard: vi.fn(),
}));

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

vi.mock("../../../../services/friend-notification-preference.service.js", () => ({
  getFriendNotificationPreference: vi.fn(),
  upsertFriendNotificationPreference: vi.fn(),
}));

vi.mock("../../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../../middleware/auth.js", () => mockAccountOnlyAuthFactory());
// ── Imports after mocks ──────────────────────────────────────────

const { getFriendDashboard } = await import("../../../../services/friend-dashboard.service.js");
const { accountRoutes } = await import("../../../../routes/account/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/account", accountRoutes);

const CONNECTION_ID = "fc_550e8400-e29b-41d4-a716-446655440000";

const MOCK_DASHBOARD: FriendDashboardResponse = {
  systemId: "sys_target" as SystemId,
  memberCount: 5,
  activeFronting: {
    sessions: [],
    isCofronting: false,
  },
  visibleMembers: [],
  visibleCustomFronts: [],
  visibleStructureEntities: [],
  keyGrants: [],
};

// ── Tests ────────────────────────────────────────────────────────

describe("GET /account/friends/:connectionId/dashboard", () => {
  beforeEach(() => {
    vi.mocked(getFriendDashboard).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with dashboard response", async () => {
    vi.mocked(getFriendDashboard).mockResolvedValueOnce(MOCK_DASHBOARD);

    const res = await createApp().request(`/account/friends/${CONNECTION_ID}/dashboard`);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: FriendDashboardResponse };
    expect(body.data.systemId).toBe("sys_target");
    expect(body.data.memberCount).toBe(5);
    expect(body.data.activeFronting.isCofronting).toBe(false);
  });

  it("passes correct args to service", async () => {
    vi.mocked(getFriendDashboard).mockResolvedValueOnce(MOCK_DASHBOARD);

    await createApp().request(`/account/friends/${CONNECTION_ID}/dashboard`);

    expect(vi.mocked(getFriendDashboard)).toHaveBeenCalledWith(
      {},
      CONNECTION_ID,
      MOCK_ACCOUNT_ONLY_AUTH,
    );
  });

  it("returns 400 for invalid connectionId format", async () => {
    const res = await createApp().request("/account/friends/not-valid/dashboard");

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 when service throws NOT_FOUND", async () => {
    vi.mocked(getFriendDashboard).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Friend connection not found"),
    );

    const res = await createApp().request(`/account/friends/${CONNECTION_ID}/dashboard`);

    expect(res.status).toBe(404);
  });
});
