import { describe, expect, it, vi } from "vitest";

// Hoisted mocks for dispatch-style external services. This same block lives at
// the top of every router integration test file. Keep these BEFORE any
// module-level import that could transitively pull in the real implementations.
vi.mock("../../../services/webhook-dispatcher.js", () => ({
  dispatchWebhookEvent: vi.fn().mockResolvedValue([]),
  invalidateWebhookConfigCache: vi.fn(),
  clearWebhookConfigCache: vi.fn(),
}));
vi.mock("../../../middleware/rate-limit.js", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
}));

import { friendRouter } from "../../../trpc/routers/friend.js";
import { testEncryptedDataBase64 } from "../../helpers/integration-setup.js";
import {
  expectAuthRequired,
  expectTenantDenied,
  seedAcceptedFriendConnection,
  seedAccountAndSystem,
  seedFriendConnection,
  setupRouterFixture,
} from "../integration-helpers.js";

/** Initial version on a freshly-created friend connection; required by updateVisibility. */
const INITIAL_FRIEND_CONNECTION_VERSION = 1;

/** Default page size for friend.exportData test calls. */
const TEST_EXPORT_PAGE_LIMIT = 25;

describe("friend router integration", () => {
  const fixture = setupRouterFixture({ friend: friendRouter });

  // ── Happy path: one test per procedure ─────────────────────────────

  describe("friend.list", () => {
    it("returns friend connections for the caller's account", async () => {
      const primary = fixture.getPrimary();
      const other = fixture.getOther();
      // seedFriendConnection returns the redeemer's row, so the row's
      // accountId == primary.accountId — listFriendConnections filters
      // by ctx.auth.accountId so we expect to see exactly that one row.
      await seedFriendConnection(fixture.getCtx().db, other, primary);
      const caller = fixture.getCaller(primary.auth);
      const result = await caller.friend.list({});
      expect(result.data.length).toBe(1);
      expect(result.data[0]?.accountId).toBe(primary.accountId);
    });
  });

  describe("friend.get", () => {
    it("returns a friend connection by id", async () => {
      const primary = fixture.getPrimary();
      const other = fixture.getOther();
      const connectionId = await seedFriendConnection(fixture.getCtx().db, other, primary);
      const caller = fixture.getCaller(primary.auth);
      const result = await caller.friend.get({ connectionId });
      expect(result.id).toBe(connectionId);
      expect(result.accountId).toBe(primary.accountId);
    });
  });

  describe("friend.accept", () => {
    it("transitions a pending connection to accepted", async () => {
      const primary = fixture.getPrimary();
      const other = fixture.getOther();
      // seedFriendConnection leaves both rows pending; primary owns the
      // returned row and is the one who can accept it.
      const connectionId = await seedFriendConnection(fixture.getCtx().db, other, primary);
      const caller = fixture.getCaller(primary.auth);
      const result = await caller.friend.accept({ connectionId });
      expect(result.id).toBe(connectionId);
      expect(result.status).toBe("accepted");
    });
  });

  describe("friend.reject", () => {
    it("transitions a pending connection to removed", async () => {
      const primary = fixture.getPrimary();
      const other = fixture.getOther();
      const connectionId = await seedFriendConnection(fixture.getCtx().db, other, primary);
      const caller = fixture.getCaller(primary.auth);
      const result = await caller.friend.reject({ connectionId });
      expect(result.id).toBe(connectionId);
      expect(result.status).toBe("removed");
    });
  });

  describe("friend.block", () => {
    it("transitions an accepted connection to blocked", async () => {
      const primary = fixture.getPrimary();
      const other = fixture.getOther();
      const connectionId = await seedAcceptedFriendConnection(fixture.getCtx().db, other, primary);
      const caller = fixture.getCaller(primary.auth);
      const result = await caller.friend.block({ connectionId });
      expect(result.id).toBe(connectionId);
      expect(result.status).toBe("blocked");
      // FriendConnectionWithRotations adds pendingRotations alongside the
      // base FriendConnectionResult; assignments are empty in this test.
      expect(Array.isArray(result.pendingRotations)).toBe(true);
    });
  });

  describe("friend.remove", () => {
    it("transitions an accepted connection to removed", async () => {
      const primary = fixture.getPrimary();
      const other = fixture.getOther();
      const connectionId = await seedAcceptedFriendConnection(fixture.getCtx().db, other, primary);
      const caller = fixture.getCaller(primary.auth);
      const result = await caller.friend.remove({ connectionId });
      expect(result.id).toBe(connectionId);
      expect(result.status).toBe("removed");
      expect(Array.isArray(result.pendingRotations)).toBe(true);
    });
  });

  describe("friend.archive", () => {
    it("archives a friend connection", async () => {
      const primary = fixture.getPrimary();
      const other = fixture.getOther();
      const connectionId = await seedFriendConnection(fixture.getCtx().db, other, primary);
      const caller = fixture.getCaller(primary.auth);
      const result = await caller.friend.archive({ connectionId });
      expect(result.success).toBe(true);
    });
  });

  describe("friend.restore", () => {
    it("restores an archived friend connection", async () => {
      const primary = fixture.getPrimary();
      const other = fixture.getOther();
      const connectionId = await seedFriendConnection(fixture.getCtx().db, other, primary);
      const caller = fixture.getCaller(primary.auth);
      await caller.friend.archive({ connectionId });
      const result = await caller.friend.restore({ connectionId });
      expect(result.id).toBe(connectionId);
    });
  });

  describe("friend.updateVisibility", () => {
    it("updates the encrypted visibility blob on a connection", async () => {
      const primary = fixture.getPrimary();
      const other = fixture.getOther();
      const connectionId = await seedFriendConnection(fixture.getCtx().db, other, primary);
      const caller = fixture.getCaller(primary.auth);
      // UpdateFriendVisibilityBodySchema requires `version` (optimistic
      // concurrency token); fresh connections start at version 1.
      const result = await caller.friend.updateVisibility({
        connectionId,
        encryptedData: testEncryptedDataBase64(),
        version: INITIAL_FRIEND_CONNECTION_VERSION,
      });
      expect(result.id).toBe(connectionId);
      expect(result.version).toBe(INITIAL_FRIEND_CONNECTION_VERSION + 1);
    });
  });

  describe("friend.getDashboard", () => {
    it("returns a dashboard for an accepted connection", async () => {
      const primary = fixture.getPrimary();
      const other = fixture.getOther();
      // assertFriendAccess requires the connection to be `accepted` and
      // owned by the caller; pass (other, primary) so primary owns the row.
      const connectionId = await seedAcceptedFriendConnection(fixture.getCtx().db, other, primary);
      const caller = fixture.getCaller(primary.auth);
      const result = await caller.friend.getDashboard({ connectionId });
      // With no bucket assignments, assertFriendAccess falls back to the
      // friend's first non-archived system, which is `other.systemId`.
      expect(result.systemId).toBe(other.systemId);
      expect(Array.isArray(result.visibleMembers)).toBe(true);
    });
  });

  describe("friend.getDashboardSync", () => {
    it("returns a sync snapshot for an accepted connection", async () => {
      const primary = fixture.getPrimary();
      const other = fixture.getOther();
      const connectionId = await seedAcceptedFriendConnection(fixture.getCtx().db, other, primary);
      const caller = fixture.getCaller(primary.auth);
      const result = await caller.friend.getDashboardSync({ connectionId });
      // FriendDashboardSyncResponse exposes per-entity-type entries; with no
      // bucket assignments every entry's count is 0 but the array is present.
      expect(Array.isArray(result.entries)).toBe(true);
    });
  });

  describe("friend.exportData", () => {
    it("returns a paginated export page for an accepted connection", async () => {
      const primary = fixture.getPrimary();
      const other = fixture.getOther();
      const connectionId = await seedAcceptedFriendConnection(fixture.getCtx().db, other, primary);
      const caller = fixture.getCaller(primary.auth);
      const result = await caller.friend.exportData({
        connectionId,
        entityType: "member",
        limit: TEST_EXPORT_PAGE_LIMIT,
      });
      // FriendExportPageResponse exposes a `data` array of encrypted entities
      // plus pagination metadata. With no bucket assignments the page is
      // empty, but the contract still holds.
      expect(Array.isArray(result.data)).toBe(true);
    });
  });

  describe("friend.exportManifest", () => {
    it("returns the export manifest for an accepted connection", async () => {
      const primary = fixture.getPrimary();
      const other = fixture.getOther();
      const connectionId = await seedAcceptedFriendConnection(fixture.getCtx().db, other, primary);
      const caller = fixture.getCaller(primary.auth);
      const result = await caller.friend.exportManifest({ connectionId });
      expect(result.systemId).toBe(other.systemId);
      expect(Array.isArray(result.entries)).toBe(true);
    });
  });

  describe("friend.getNotifications", () => {
    it("creates default notification preferences when none exist", async () => {
      const primary = fixture.getPrimary();
      const other = fixture.getOther();
      const connectionId = await seedFriendConnection(fixture.getCtx().db, other, primary);
      const caller = fixture.getCaller(primary.auth);
      const result = await caller.friend.getNotifications({ connectionId });
      expect(result.friendConnectionId).toBe(connectionId);
      expect(result.accountId).toBe(primary.accountId);
      // Service seeds defaults on first read; assert the array shape rather
      // than the exact contents to stay decoupled from the default list.
      expect(Array.isArray(result.enabledEventTypes)).toBe(true);
    });
  });

  describe("friend.listReceivedKeyGrants", () => {
    it("returns an empty grants array when no grants have been received", async () => {
      const primary = fixture.getPrimary();
      const caller = fixture.getCaller(primary.auth);
      // ReceivedKeyGrantsResponse is `{ grants: [...] }`, not a bare array.
      const result = await caller.friend.listReceivedKeyGrants();
      expect(Array.isArray(result.grants)).toBe(true);
      expect(result.grants.length).toBe(0);
    });
  });

  describe("friend.updateNotifications", () => {
    it("updates the enabled event-type list on a notification preference", async () => {
      const primary = fixture.getPrimary();
      const other = fixture.getOther();
      const connectionId = await seedFriendConnection(fixture.getCtx().db, other, primary);
      const caller = fixture.getCaller(primary.auth);
      // updateFriendNotificationPreference relies on a row already existing;
      // calling get-or-create first matches the production read-then-update
      // flow used by the mobile client.
      await caller.friend.getNotifications({ connectionId });
      const result = await caller.friend.updateNotifications({
        connectionId,
        enabledEventTypes: ["friend-switch-alert"],
      });
      expect(result.friendConnectionId).toBe(connectionId);
      expect(result.enabledEventTypes).toEqual(["friend-switch-alert"]);
    });
  });

  // ── Auth-failure: one test for the whole router ────────────────────

  describe("auth", () => {
    it("rejects unauthenticated calls with UNAUTHORIZED", async () => {
      const caller = fixture.getCaller(null);
      await expectAuthRequired(caller.friend.list({}));
    });
  });

  // ── Tenant isolation: one test for the whole router ────────────────

  describe("tenant isolation", () => {
    it("rejects when an outsider tries to read another tenant's friend connection", async () => {
      const primary = fixture.getPrimary();
      const other = fixture.getOther();
      const db = fixture.getCtx().db;
      // primary <-> other share an accepted connection; outsider must not
      // be able to read it via either side's connectionId.
      const connectionId = await seedAcceptedFriendConnection(db, other, primary);
      const outsider = await seedAccountAndSystem(db);
      const caller = fixture.getCaller(outsider.auth);
      await expectTenantDenied(caller.friend.get({ connectionId }));
    });
  });
});
