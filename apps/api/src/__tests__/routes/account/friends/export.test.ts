import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAccountOnlyAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../../helpers/common-route-mocks.js";
import { MOCK_ACCOUNT_ONLY_AUTH, createRouteApp } from "../../../helpers/route-test-setup.js";

import type { FriendExportManifestResponse, SystemId, UnixMillis } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../../services/friend-export.service.js", () => ({
  getFriendExportManifest: vi.fn(),
  getFriendExportPage: vi.fn(),
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
  getOrCreateFriendNotificationPreference: vi.fn(),
  updateFriendNotificationPreference: vi.fn(),
  listFriendNotificationPreferences: vi.fn(),
}));

vi.mock("../../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../../middleware/auth.js", () => mockAccountOnlyAuthFactory());
// ── Imports after mocks ──────────────────────────────────────────

const { getFriendExportManifest, getFriendExportPage } =
  await import("../../../../services/friend-export.service.js");
const { accountRoutes } = await import("../../../../routes/account/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/account", accountRoutes);

const CONNECTION_ID = "fc_550e8400-e29b-41d4-a716-446655440000";

const MOCK_MANIFEST: FriendExportManifestResponse = {
  systemId: "sys_target" as SystemId,
  entries: [{ entityType: "member", count: 5, lastUpdatedAt: 2000 as UnixMillis }],
  keyGrants: [],
  etag: "test-etag",
};

const MOCK_PAGE = {
  data: [],
  nextCursor: null,
  hasMore: false,
  totalCount: null,
  etag: "page-etag",
};

// ── Tests ────────────────────────────────────────────────────────

describe("GET /account/friends/:connectionId/export/manifest", () => {
  beforeEach(() => {
    vi.mocked(getFriendExportManifest).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with manifest response", async () => {
    vi.mocked(getFriendExportManifest).mockResolvedValueOnce(MOCK_MANIFEST);

    const res = await createApp().request(`/account/friends/${CONNECTION_ID}/export/manifest`);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: FriendExportManifestResponse };
    expect(body.data.systemId).toBe("sys_target");
    expect(body.data.entries).toHaveLength(1);
  });

  it("sets ETag header", async () => {
    vi.mocked(getFriendExportManifest).mockResolvedValueOnce(MOCK_MANIFEST);

    const res = await createApp().request(`/account/friends/${CONNECTION_ID}/export/manifest`);

    expect(res.headers.get("ETag")).toBe("test-etag");
  });

  it("returns 304 when If-None-Match matches", async () => {
    vi.mocked(getFriendExportManifest).mockResolvedValueOnce(MOCK_MANIFEST);

    const res = await createApp().request(`/account/friends/${CONNECTION_ID}/export/manifest`, {
      headers: { "If-None-Match": "test-etag" },
    });

    expect(res.status).toBe(304);
  });

  it("passes auth context to service", async () => {
    vi.mocked(getFriendExportManifest).mockResolvedValueOnce(MOCK_MANIFEST);

    await createApp().request(`/account/friends/${CONNECTION_ID}/export/manifest`);

    expect(vi.mocked(getFriendExportManifest)).toHaveBeenCalledWith(
      {},
      CONNECTION_ID,
      MOCK_ACCOUNT_ONLY_AUTH,
    );
  });

  it("returns 400 for invalid connectionId", async () => {
    const res = await createApp().request("/account/friends/invalid-id/export/manifest");

    expect(res.status).toBe(400);
  });
});

describe("GET /account/friends/:connectionId/export", () => {
  beforeEach(() => {
    vi.mocked(getFriendExportPage).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with paginated export", async () => {
    vi.mocked(getFriendExportPage).mockResolvedValueOnce(MOCK_PAGE);

    const res = await createApp().request(
      `/account/friends/${CONNECTION_ID}/export?entityType=member&limit=10`,
    );

    expect(res.status).toBe(200);
  });

  it("sets ETag header", async () => {
    vi.mocked(getFriendExportPage).mockResolvedValueOnce(MOCK_PAGE);

    const res = await createApp().request(
      `/account/friends/${CONNECTION_ID}/export?entityType=member&limit=10`,
    );

    expect(res.headers.get("ETag")).toBe("page-etag");
  });

  it("returns 304 when If-None-Match matches", async () => {
    vi.mocked(getFriendExportPage).mockResolvedValueOnce(MOCK_PAGE);

    const res = await createApp().request(
      `/account/friends/${CONNECTION_ID}/export?entityType=member&limit=10`,
      { headers: { "If-None-Match": "page-etag" } },
    );

    expect(res.status).toBe(304);
  });

  it("returns 400 for missing entityType", async () => {
    const res = await createApp().request(`/account/friends/${CONNECTION_ID}/export?limit=10`);

    expect(res.status).toBe(400);
  });

  it("passes query params to service", async () => {
    vi.mocked(getFriendExportPage).mockResolvedValueOnce(MOCK_PAGE);

    await createApp().request(
      `/account/friends/${CONNECTION_ID}/export?entityType=member&limit=5&cursor=abc`,
    );

    expect(vi.mocked(getFriendExportPage)).toHaveBeenCalledWith(
      {},
      CONNECTION_ID,
      MOCK_ACCOUNT_ONLY_AUTH,
      "member",
      5,
      "abc",
    );
  });
});
