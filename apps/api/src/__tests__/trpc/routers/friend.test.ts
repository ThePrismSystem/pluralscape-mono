import { beforeEach, describe, expect, it, vi } from "vitest";

import { MOCK_AUTH, makeCallerFactory, assertProcedureRateLimited } from "../test-helpers.js";

import type { AccountId, FriendConnectionId, UnixMillis } from "@pluralscape/types";

vi.mock("../../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../middleware/rate-limit.js", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
}));

vi.mock("../../../services/friend-connection.service.js", () => ({
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

vi.mock("../../../services/friend-dashboard-sync.service.js", () => ({
  getFriendDashboardSync: vi.fn(),
}));

vi.mock("../../../services/friend-dashboard.service.js", () => ({
  getFriendDashboard: vi.fn(),
}));

vi.mock("../../../services/friend-export.service.js", () => ({
  getFriendExportManifest: vi.fn(),
  getFriendExportPage: vi.fn(),
}));

vi.mock("../../../services/friend-notification-preference.service.js", () => ({
  getOrCreateFriendNotificationPreference: vi.fn(),
  updateFriendNotificationPreference: vi.fn(),
}));

vi.mock("../../../services/key-grant.service.js", () => ({
  listReceivedKeyGrants: vi.fn(),
}));

const {
  acceptFriendConnection,
  archiveFriendConnection,
  blockFriendConnection,
  getFriendConnection,
  listFriendConnections,
  rejectFriendConnection,
  removeFriendConnection,
  restoreFriendConnection,
  updateFriendVisibility,
} = await import("../../../services/friend-connection.service.js");
const { getFriendDashboardSync } =
  await import("../../../services/friend-dashboard-sync.service.js");
const { getFriendDashboard } = await import("../../../services/friend-dashboard.service.js");
const { getFriendExportManifest, getFriendExportPage } =
  await import("../../../services/friend-export.service.js");
const { getOrCreateFriendNotificationPreference, updateFriendNotificationPreference } =
  await import("../../../services/friend-notification-preference.service.js");
const { listReceivedKeyGrants } = await import("../../../services/key-grant.service.js");

const { friendRouter } = await import("../../../trpc/routers/friend.js");

const createCaller = makeCallerFactory({ friend: friendRouter });

const CONNECTION_ID = "fc_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" as FriendConnectionId;
const FRIEND_ACCOUNT_ID = "acc_ffffffff-bbbb-cccc-dddd-eeeeeeeeeeee" as AccountId;

const MOCK_CONNECTION = {
  id: CONNECTION_ID,
  accountId: MOCK_AUTH.accountId,
  friendAccountId: FRIEND_ACCOUNT_ID,
  status: "accepted" as const,
  encryptedData: null,
  version: 1,
  archived: false,
  archivedAt: null,
  createdAt: 1_000 as UnixMillis,
  updatedAt: 1_000 as UnixMillis,
  acceptedAt: 1_500 as UnixMillis,
  removedAt: null,
};

const MOCK_CONNECTION_WITH_ROTATIONS = {
  ...MOCK_CONNECTION,
  pendingRotations: [],
};

const EMPTY_LIST = {
  data: [],
  nextCursor: null,
  hasMore: false,
  totalCount: null,
};

describe("friend router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── list ─────────────────────────────────────────────────────────────

  describe("friend.list", () => {
    it("calls listFriendConnections with default args", async () => {
      vi.mocked(listFriendConnections).mockResolvedValue(EMPTY_LIST);
      const caller = createCaller();
      await caller.friend.list({});

      expect(vi.mocked(listFriendConnections)).toHaveBeenCalledOnce();
      expect(vi.mocked(listFriendConnections).mock.calls[0]?.[1]).toBe(MOCK_AUTH.accountId);
    });

    it("passes cursor, limit, includeArchived, status to service", async () => {
      vi.mocked(listFriendConnections).mockResolvedValue(EMPTY_LIST);
      const caller = createCaller();
      await caller.friend.list({
        cursor: "abc",
        limit: 10,
        includeArchived: true,
        status: "pending",
      });

      const opts = vi.mocked(listFriendConnections).mock.calls[0]?.[3];
      expect(opts?.cursor).toBe("abc");
      expect(opts?.limit).toBe(10);
      expect(opts?.includeArchived).toBe(true);
      expect(opts?.status).toBe("pending");
    });

    it("converts null cursor to undefined", async () => {
      vi.mocked(listFriendConnections).mockResolvedValue(EMPTY_LIST);
      const caller = createCaller();
      await caller.friend.list({ cursor: null });

      const opts = vi.mocked(listFriendConnections).mock.calls[0]?.[3];
      expect(opts?.cursor).toBeUndefined();
    });
  });

  // ── get ──────────────────────────────────────────────────────────────

  describe("friend.get", () => {
    it("calls getFriendConnection with connectionId", async () => {
      vi.mocked(getFriendConnection).mockResolvedValue(MOCK_CONNECTION);
      const caller = createCaller();
      const result = await caller.friend.get({ connectionId: CONNECTION_ID });

      expect(vi.mocked(getFriendConnection)).toHaveBeenCalledOnce();
      expect(vi.mocked(getFriendConnection).mock.calls[0]?.[2]).toBe(CONNECTION_ID);
      expect(result).toEqual(MOCK_CONNECTION);
    });

    it("rejects invalid connectionId format", async () => {
      const caller = createCaller();
      await expect(
        caller.friend.get({ connectionId: "not-a-connection" as FriendConnectionId }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });
  });

  // ── accept ───────────────────────────────────────────────────────────

  describe("friend.accept", () => {
    it("calls acceptFriendConnection and returns the result", async () => {
      vi.mocked(acceptFriendConnection).mockResolvedValue(MOCK_CONNECTION_WITH_ROTATIONS);
      const caller = createCaller();
      await caller.friend.accept({ connectionId: CONNECTION_ID });

      expect(vi.mocked(acceptFriendConnection)).toHaveBeenCalledOnce();
      expect(vi.mocked(acceptFriendConnection).mock.calls[0]?.[2]).toBe(CONNECTION_ID);
    });
  });

  // ── reject ───────────────────────────────────────────────────────────

  describe("friend.reject", () => {
    it("calls rejectFriendConnection", async () => {
      vi.mocked(rejectFriendConnection).mockResolvedValue(MOCK_CONNECTION);
      const caller = createCaller();
      await caller.friend.reject({ connectionId: CONNECTION_ID });

      expect(vi.mocked(rejectFriendConnection)).toHaveBeenCalledOnce();
    });
  });

  // ── block ────────────────────────────────────────────────────────────

  describe("friend.block", () => {
    it("calls blockFriendConnection", async () => {
      vi.mocked(blockFriendConnection).mockResolvedValue(MOCK_CONNECTION_WITH_ROTATIONS);
      const caller = createCaller();
      await caller.friend.block({ connectionId: CONNECTION_ID });

      expect(vi.mocked(blockFriendConnection)).toHaveBeenCalledOnce();
    });
  });

  // ── remove ───────────────────────────────────────────────────────────

  describe("friend.remove", () => {
    it("calls removeFriendConnection", async () => {
      vi.mocked(removeFriendConnection).mockResolvedValue(MOCK_CONNECTION_WITH_ROTATIONS);
      const caller = createCaller();
      await caller.friend.remove({ connectionId: CONNECTION_ID });

      expect(vi.mocked(removeFriendConnection)).toHaveBeenCalledOnce();
    });
  });

  // ── archive ──────────────────────────────────────────────────────────

  describe("friend.archive", () => {
    it("calls archiveFriendConnection and returns success", async () => {
      vi.mocked(archiveFriendConnection).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.friend.archive({ connectionId: CONNECTION_ID });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(archiveFriendConnection)).toHaveBeenCalledOnce();
    });
  });

  // ── restore ──────────────────────────────────────────────────────────

  describe("friend.restore", () => {
    it("calls restoreFriendConnection", async () => {
      vi.mocked(restoreFriendConnection).mockResolvedValue(MOCK_CONNECTION);
      const caller = createCaller();
      await caller.friend.restore({ connectionId: CONNECTION_ID });

      expect(vi.mocked(restoreFriendConnection)).toHaveBeenCalledOnce();
    });
  });

  // ── updateVisibility ─────────────────────────────────────────────────

  describe("friend.updateVisibility", () => {
    it("calls updateFriendVisibility with parsed body", async () => {
      vi.mocked(updateFriendVisibility).mockResolvedValue(MOCK_CONNECTION);
      const caller = createCaller();
      await caller.friend.updateVisibility({
        connectionId: CONNECTION_ID,
        encryptedData: "dXBkYXRlZA==",
        version: 2,
      });

      expect(vi.mocked(updateFriendVisibility)).toHaveBeenCalledOnce();
      const callArgs = vi.mocked(updateFriendVisibility).mock.calls[0];
      expect(callArgs?.[2]).toBe(CONNECTION_ID);
      expect(callArgs?.[3]).toEqual({ encryptedData: "dXBkYXRlZA==", version: 2 });
    });

    it("rejects body with version 0 (zod min(1))", async () => {
      const caller = createCaller();
      await expect(
        caller.friend.updateVisibility({
          connectionId: CONNECTION_ID,
          encryptedData: "dGVzdA==",
          version: 0,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });
  });

  // ── getDashboard ─────────────────────────────────────────────────────

  describe("friend.getDashboard", () => {
    it("calls getFriendDashboard with connectionId", async () => {
      const mockDashboard = { id: CONNECTION_ID, sessions: [] };
      vi.mocked(getFriendDashboard).mockResolvedValue(mockDashboard as never);
      const caller = createCaller();
      await caller.friend.getDashboard({ connectionId: CONNECTION_ID });

      expect(vi.mocked(getFriendDashboard)).toHaveBeenCalledOnce();
      expect(vi.mocked(getFriendDashboard).mock.calls[0]?.[1]).toBe(CONNECTION_ID);
    });
  });

  // ── getDashboardSync ─────────────────────────────────────────────────

  describe("friend.getDashboardSync", () => {
    it("calls getFriendDashboardSync with connectionId", async () => {
      vi.mocked(getFriendDashboardSync).mockResolvedValue({} as never);
      const caller = createCaller();
      await caller.friend.getDashboardSync({ connectionId: CONNECTION_ID });

      expect(vi.mocked(getFriendDashboardSync)).toHaveBeenCalledOnce();
    });
  });

  // ── exportData ───────────────────────────────────────────────────────

  describe("friend.exportData", () => {
    it("calls getFriendExportPage with parsed args", async () => {
      vi.mocked(getFriendExportPage).mockResolvedValue({ data: [], nextCursor: null } as never);
      const caller = createCaller();
      await caller.friend.exportData({
        connectionId: CONNECTION_ID,
        entityType: "member",
        cursor: "abc",
        limit: 25,
      });

      expect(vi.mocked(getFriendExportPage)).toHaveBeenCalledOnce();
      const callArgs = vi.mocked(getFriendExportPage).mock.calls[0];
      expect(callArgs?.[1]).toBe(CONNECTION_ID);
      expect(callArgs?.[3]).toBe("member");
      expect(callArgs?.[4]).toBe(25);
      expect(callArgs?.[5]).toBe("abc");
    });
  });

  // ── exportManifest ───────────────────────────────────────────────────

  describe("friend.exportManifest", () => {
    it("calls getFriendExportManifest with connectionId", async () => {
      vi.mocked(getFriendExportManifest).mockResolvedValue({} as never);
      const caller = createCaller();
      await caller.friend.exportManifest({ connectionId: CONNECTION_ID });

      expect(vi.mocked(getFriendExportManifest)).toHaveBeenCalledOnce();
    });
  });

  // ── getNotifications ─────────────────────────────────────────────────

  describe("friend.getNotifications", () => {
    it("calls getOrCreateFriendNotificationPreference", async () => {
      vi.mocked(getOrCreateFriendNotificationPreference).mockResolvedValue({} as never);
      const caller = createCaller();
      await caller.friend.getNotifications({ connectionId: CONNECTION_ID });

      expect(vi.mocked(getOrCreateFriendNotificationPreference)).toHaveBeenCalledOnce();
      expect(vi.mocked(getOrCreateFriendNotificationPreference).mock.calls[0]?.[2]).toBe(
        CONNECTION_ID,
      );
    });
  });

  // ── listReceivedKeyGrants ────────────────────────────────────────────

  describe("friend.listReceivedKeyGrants", () => {
    it("calls listReceivedKeyGrants with accountId", async () => {
      vi.mocked(listReceivedKeyGrants).mockResolvedValue([] as never);
      const caller = createCaller();
      await caller.friend.listReceivedKeyGrants();

      expect(vi.mocked(listReceivedKeyGrants)).toHaveBeenCalledOnce();
      expect(vi.mocked(listReceivedKeyGrants).mock.calls[0]?.[1]).toBe(MOCK_AUTH.accountId);
    });
  });

  // ── updateNotifications ──────────────────────────────────────────────

  describe("friend.updateNotifications", () => {
    it("calls updateFriendNotificationPreference with parsed body", async () => {
      vi.mocked(updateFriendNotificationPreference).mockResolvedValue({} as never);
      const caller = createCaller();
      await caller.friend.updateNotifications({
        connectionId: CONNECTION_ID,
        enabledEventTypes: ["friend-switch-alert"],
      });

      expect(vi.mocked(updateFriendNotificationPreference)).toHaveBeenCalledOnce();
      const callArgs = vi.mocked(updateFriendNotificationPreference).mock.calls[0];
      expect(callArgs?.[2]).toBe(CONNECTION_ID);
    });
  });

  // ── auth ─────────────────────────────────────────────────────────────

  it("throws UNAUTHORIZED for unauthenticated callers", async () => {
    const caller = createCaller(null);
    await expect(caller.friend.list({})).rejects.toThrow(
      expect.objectContaining({ code: "UNAUTHORIZED" }),
    );
  });

  // ── rate limiting ────────────────────────────────────────────────────

  it("applies readDefault rate limiting to queries", async () => {
    const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
    vi.mocked(listFriendConnections).mockResolvedValue(EMPTY_LIST);
    const caller = createCaller();
    await assertProcedureRateLimited(
      vi.mocked(checkRateLimit),
      () => caller.friend.list({}),
      "readDefault",
    );
  });

  it("applies write rate limiting to mutations", async () => {
    const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
    vi.mocked(acceptFriendConnection).mockResolvedValue(MOCK_CONNECTION);
    const caller = createCaller();
    await assertProcedureRateLimited(
      vi.mocked(checkRateLimit),
      () => caller.friend.accept({ connectionId: CONNECTION_ID }),
      "write",
    );
  });
});
