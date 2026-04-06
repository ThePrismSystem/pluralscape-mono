import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../../../lib/api-error.js";
import {
  mockAccountOnlyAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
  mockScopeFactory,
} from "../../../helpers/common-route-mocks.js";
import { MOCK_ACCOUNT_ONLY_AUTH, createRouteApp } from "../../../helpers/route-test-setup.js";

import type {
  ApiErrorResponse,
  FriendDashboardSyncResponse,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../../services/friend-dashboard-sync.service.js", () => ({
  getFriendDashboardSync: vi.fn(),
}));

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

vi.mock("../../../../middleware/scope.js", () => mockScopeFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { getFriendDashboardSync } =
  await import("../../../../services/friend-dashboard-sync.service.js");
const { accountRoutes } = await import("../../../../routes/account/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/account", accountRoutes);

const CONNECTION_ID = "fc_550e8400-e29b-41d4-a716-446655440000";

const MOCK_SYNC_RESPONSE: FriendDashboardSyncResponse = {
  systemId: "sys_target" as SystemId,
  entries: [
    { entityType: "member", count: 5, latestUpdatedAt: 1000 as UnixMillis },
    { entityType: "custom-front", count: 2, latestUpdatedAt: 900 as UnixMillis },
    { entityType: "structure-entity", count: 1, latestUpdatedAt: 800 as UnixMillis },
    { entityType: "fronting-session", count: 3, latestUpdatedAt: 1100 as UnixMillis },
  ],
};

// ── Tests ────────────────────────────────────────────────────────

describe("GET /account/friends/:connectionId/dashboard/sync", () => {
  beforeEach(() => {
    vi.mocked(getFriendDashboardSync).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with sync response", async () => {
    vi.mocked(getFriendDashboardSync).mockResolvedValueOnce(MOCK_SYNC_RESPONSE);

    const res = await createApp().request(`/account/friends/${CONNECTION_ID}/dashboard/sync`);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: FriendDashboardSyncResponse };
    expect(body.data.systemId).toBe("sys_target");
    expect(body.data.entries).toHaveLength(4);
    expect(body.data.entries[0]).toEqual({
      entityType: "member",
      count: 5,
      latestUpdatedAt: 1000,
    });
  });

  it("passes correct args to service", async () => {
    vi.mocked(getFriendDashboardSync).mockResolvedValueOnce(MOCK_SYNC_RESPONSE);

    await createApp().request(`/account/friends/${CONNECTION_ID}/dashboard/sync`);

    expect(vi.mocked(getFriendDashboardSync)).toHaveBeenCalledWith(
      {},
      CONNECTION_ID,
      MOCK_ACCOUNT_ONLY_AUTH,
    );
  });

  it("returns 400 for invalid connectionId format", async () => {
    const res = await createApp().request("/account/friends/not-valid/dashboard/sync");

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 when service throws NOT_FOUND", async () => {
    vi.mocked(getFriendDashboardSync).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Friend connection not found"),
    );

    const res = await createApp().request(`/account/friends/${CONNECTION_ID}/dashboard/sync`);

    expect(res.status).toBe(404);
  });

  it("re-throws unexpected errors as 500", async () => {
    vi.mocked(getFriendDashboardSync).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const res = await createApp().request(`/account/friends/${CONNECTION_ID}/dashboard/sync`);

    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
