import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAccountOnlyAuthFactory,
  mockAuditWriterFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../../../helpers/common-route-mocks.js";
import {
  MOCK_ACCOUNT_ONLY_AUTH,
  createRouteApp,
  patchJSON,
} from "../../../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../../../services/friend-notification-preference.service.js", () => ({
  getOrCreateFriendNotificationPreference: vi.fn(),
  updateFriendNotificationPreference: vi.fn(),
  listFriendNotificationPreferences: vi.fn(),
}));

vi.mock("../../../../../services/account/friends/lifecycle.js", () => ({
  archiveFriendConnection: vi.fn(),
  restoreFriendConnection: vi.fn(),
}));
vi.mock("../../../../../services/account/friends/queries.js", () => ({
  getFriendConnection: vi.fn(),
  listFriendConnections: vi.fn(),
}));
vi.mock("../../../../../services/account/friends/transitions.js", () => ({
  acceptFriendConnection: vi.fn(),
  blockFriendConnection: vi.fn(),
  rejectFriendConnection: vi.fn(),
  removeFriendConnection: vi.fn(),
}));
vi.mock("../../../../../services/account/friends/update.js", () => ({
  updateFriendVisibility: vi.fn(),
}));

vi.mock("../../../../../services/friend-export.service.js", () => ({
  getFriendExportManifest: vi.fn(),
  getFriendExportPage: vi.fn(),
}));

vi.mock("../../../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../../../middleware/auth.js", () => mockAccountOnlyAuthFactory());
// ── Imports after mocks ──────────────────────────────────────────

const { getOrCreateFriendNotificationPreference, updateFriendNotificationPreference } =
  await import("../../../../../services/friend-notification-preference.service.js");
const { accountRoutes } = await import("../../../../../routes/account/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/account", accountRoutes);

const CONNECTION_ID = "fc_550e8400-e29b-41d4-a716-446655440000";
const BASE_URL = `/account/friends/${CONNECTION_ID}/notifications`;

const MOCK_PREFERENCE = {
  id: "fnp_660e8400-e29b-41d4-a716-446655440000",
  accountId: "acct_test",
  connectionId: CONNECTION_ID,
  enabledEventTypes: ["friend-switch-alert"],
  pushEnabled: true,
  createdAt: 1000,
  updatedAt: 1000,
};

// ── Tests ────────────────────────────────────────────────────────

describe("GET /account/friends/:connectionId/notifications", () => {
  beforeEach(() => {
    vi.mocked(getOrCreateFriendNotificationPreference).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with preference", async () => {
    vi.mocked(getOrCreateFriendNotificationPreference).mockResolvedValueOnce(
      MOCK_PREFERENCE as never,
    );

    const res = await createApp().request(BASE_URL);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: typeof MOCK_PREFERENCE };
    expect(body.data.id).toBe(MOCK_PREFERENCE.id);
  });

  it("passes connectionId and auth to service", async () => {
    vi.mocked(getOrCreateFriendNotificationPreference).mockResolvedValueOnce(
      MOCK_PREFERENCE as never,
    );

    await createApp().request(BASE_URL);

    expect(vi.mocked(getOrCreateFriendNotificationPreference)).toHaveBeenCalledWith(
      {},
      MOCK_ACCOUNT_ONLY_AUTH.accountId,
      CONNECTION_ID,
      MOCK_ACCOUNT_ONLY_AUTH,
    );
  });

  it("returns 400 for invalid connectionId", async () => {
    const res = await createApp().request("/account/friends/invalid-id/notifications");

    expect(res.status).toBe(400);
  });
});

describe("PATCH /account/friends/:connectionId/notifications", () => {
  beforeEach(() => {
    vi.mocked(updateFriendNotificationPreference).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with updated preference", async () => {
    vi.mocked(updateFriendNotificationPreference).mockResolvedValueOnce({
      ...MOCK_PREFERENCE,
      enabledEventTypes: [],
    } as never);

    const res = await patchJSON(createApp(), BASE_URL, {
      enabledEventTypes: [],
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: typeof MOCK_PREFERENCE };
    expect(body.data.enabledEventTypes).toEqual([]);
  });

  it("passes params and auth to service", async () => {
    vi.mocked(updateFriendNotificationPreference).mockResolvedValueOnce(MOCK_PREFERENCE as never);

    await patchJSON(createApp(), BASE_URL, {
      enabledEventTypes: ["friend-switch-alert"],
    });

    expect(vi.mocked(updateFriendNotificationPreference)).toHaveBeenCalledWith(
      {},
      MOCK_ACCOUNT_ONLY_AUTH.accountId,
      CONNECTION_ID,
      { enabledEventTypes: ["friend-switch-alert"] },
      MOCK_ACCOUNT_ONLY_AUTH,
      expect.any(Function),
    );
  });

  it("returns 400 for invalid body", async () => {
    const res = await patchJSON(createApp(), BASE_URL, {
      enabledEventTypes: "not-an-array",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid connectionId", async () => {
    const res = await patchJSON(createApp(), "/account/friends/invalid-id/notifications", {
      enabledEventTypes: [],
    });

    expect(res.status).toBe(400);
  });
});
