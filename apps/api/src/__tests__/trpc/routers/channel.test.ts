import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../../lib/api-error.js";
import { createCallerFactory, router } from "../../../trpc/trpc.js";

import type { AuditWriter } from "../../../lib/audit-writer.js";
import type { AuthContext } from "../../../lib/auth-context.js";
import type { TRPCContext } from "../../../trpc/context.js";
import type { AccountId, ChannelId, SessionId, SystemId, UnixMillis } from "@pluralscape/types";

vi.mock("../../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../services/channel.service.js", () => ({
  createChannel: vi.fn(),
  getChannel: vi.fn(),
  listChannels: vi.fn(),
  updateChannel: vi.fn(),
  archiveChannel: vi.fn(),
  restoreChannel: vi.fn(),
  deleteChannel: vi.fn(),
}));

const {
  createChannel,
  getChannel,
  listChannels,
  updateChannel,
  archiveChannel,
  restoreChannel,
  deleteChannel,
} = await import("../../../services/channel.service.js");

const { channelRouter } = await import("../../../trpc/routers/channel.js");

const SYSTEM_ID = "sys_550e8400-e29b-41d4-a716-446655440000" as SystemId;
const CHANNEL_ID = "ch_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" as ChannelId;
const VALID_ENCRYPTED_DATA = "dGVzdGRhdGFmb3JjaGFubmVs";

const MOCK_AUTH: AuthContext = {
  accountId: "acct_test001" as AccountId,
  systemId: SYSTEM_ID,
  sessionId: "sess_test001" as SessionId,
  accountType: "system",
  ownedSystemIds: new Set([SYSTEM_ID]),
  auditLogIpTracking: false,
};

const noopAuditWriter: AuditWriter = () => Promise.resolve();

function makeContext(auth: AuthContext | null): TRPCContext {
  return {
    db: {} as TRPCContext["db"],
    auth,
    createAudit: () => noopAuditWriter,
    requestMeta: { ipAddress: null, userAgent: null },
  };
}

function makeCaller(auth: AuthContext | null = MOCK_AUTH) {
  const appRouter = router({ channel: channelRouter });
  const createCaller = createCallerFactory(appRouter);
  return createCaller(makeContext(auth));
}

const MOCK_CHANNEL_RESULT = {
  id: CHANNEL_ID,
  systemId: SYSTEM_ID,
  type: "channel" as const,
  parentId: null,
  sortOrder: 0,
  encryptedData: "base64data==",
  version: 1,
  archived: false,
  archivedAt: null,
  createdAt: 1_700_000_000_000 as UnixMillis,
  updatedAt: 1_700_000_000_000 as UnixMillis,
};

describe("channel router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── create ────────────────────────────────────────────────────────

  describe("channel.create", () => {
    it("calls createChannel with correct systemId and returns result", async () => {
      vi.mocked(createChannel).mockResolvedValue(MOCK_CHANNEL_RESULT);
      const caller = makeCaller();
      const result = await caller.channel.create({
        systemId: SYSTEM_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
        type: "channel",
        sortOrder: 0,
        parentId: undefined,
      });

      expect(vi.mocked(createChannel)).toHaveBeenCalledOnce();
      expect(vi.mocked(createChannel).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(result).toEqual(MOCK_CHANNEL_RESULT);
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = makeCaller(null);
      await expect(
        caller.channel.create({
          systemId: SYSTEM_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          type: "channel",
          sortOrder: 0,
          parentId: undefined,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));
    });

    it("throws NOT_FOUND when systemId is not owned", async () => {
      const foreignSystemId = "sys_ffffffff-ffff-ffff-ffff-ffffffffffff" as SystemId;
      const caller = makeCaller();
      await expect(
        caller.channel.create({
          systemId: foreignSystemId,
          encryptedData: VALID_ENCRYPTED_DATA,
          type: "channel",
          sortOrder: 0,
          parentId: undefined,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── get ───────────────────────────────────────────────────────────

  describe("channel.get", () => {
    it("calls getChannel with correct systemId and channelId", async () => {
      vi.mocked(getChannel).mockResolvedValue(MOCK_CHANNEL_RESULT);
      const caller = makeCaller();
      const result = await caller.channel.get({ systemId: SYSTEM_ID, channelId: CHANNEL_ID });

      expect(vi.mocked(getChannel)).toHaveBeenCalledOnce();
      expect(vi.mocked(getChannel).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(getChannel).mock.calls[0]?.[2]).toBe(CHANNEL_ID);
      expect(result).toEqual(MOCK_CHANNEL_RESULT);
    });

    it("rejects invalid channelId format", async () => {
      const caller = makeCaller();
      await expect(
        caller.channel.get({ systemId: SYSTEM_ID, channelId: "invalid-id" as ChannelId }),
      ).rejects.toThrow();
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(getChannel).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Channel not found"),
      );
      const caller = makeCaller();
      await expect(
        caller.channel.get({ systemId: SYSTEM_ID, channelId: CHANNEL_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── list ──────────────────────────────────────────────────────────

  describe("channel.list", () => {
    it("calls listChannels and returns result", async () => {
      const mockResult = {
        data: [MOCK_CHANNEL_RESULT],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      };
      vi.mocked(listChannels).mockResolvedValue(mockResult);
      const caller = makeCaller();
      const result = await caller.channel.list({ systemId: SYSTEM_ID });

      expect(vi.mocked(listChannels)).toHaveBeenCalledOnce();
      expect(vi.mocked(listChannels).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(result).toEqual(mockResult);
    });

    it("passes cursor, limit, and includeArchived as opts", async () => {
      vi.mocked(listChannels).mockResolvedValue({
        data: [],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      });
      const caller = makeCaller();
      await caller.channel.list({
        systemId: SYSTEM_ID,
        cursor: "cur_abc",
        limit: 10,
        includeArchived: true,
      });

      const opts = vi.mocked(listChannels).mock.calls[0]?.[3];
      expect(opts?.cursor).toBe("cur_abc");
      expect(opts?.limit).toBe(10);
      expect(opts?.includeArchived).toBe(true);
    });
  });

  // ── update ────────────────────────────────────────────────────────

  describe("channel.update", () => {
    it("calls updateChannel with correct systemId and channelId", async () => {
      vi.mocked(updateChannel).mockResolvedValue(MOCK_CHANNEL_RESULT);
      const caller = makeCaller();
      const result = await caller.channel.update({
        systemId: SYSTEM_ID,
        channelId: CHANNEL_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
        version: 1,
      });

      expect(vi.mocked(updateChannel)).toHaveBeenCalledOnce();
      expect(vi.mocked(updateChannel).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(updateChannel).mock.calls[0]?.[2]).toBe(CHANNEL_ID);
      expect(result).toEqual(MOCK_CHANNEL_RESULT);
    });

    it("surfaces ApiHttpError(409) as CONFLICT", async () => {
      vi.mocked(updateChannel).mockRejectedValue(
        new ApiHttpError(409, "CONFLICT", "Version mismatch"),
      );
      const caller = makeCaller();
      await expect(
        caller.channel.update({
          systemId: SYSTEM_ID,
          channelId: CHANNEL_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          version: 1,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "CONFLICT" }));
    });
  });

  // ── archive ───────────────────────────────────────────────────────

  describe("channel.archive", () => {
    it("calls archiveChannel and returns success", async () => {
      vi.mocked(archiveChannel).mockResolvedValue(undefined);
      const caller = makeCaller();
      const result = await caller.channel.archive({ systemId: SYSTEM_ID, channelId: CHANNEL_ID });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(archiveChannel)).toHaveBeenCalledOnce();
      expect(vi.mocked(archiveChannel).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(archiveChannel).mock.calls[0]?.[2]).toBe(CHANNEL_ID);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(archiveChannel).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Channel not found"),
      );
      const caller = makeCaller();
      await expect(
        caller.channel.archive({ systemId: SYSTEM_ID, channelId: CHANNEL_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── restore ───────────────────────────────────────────────────────

  describe("channel.restore", () => {
    it("calls restoreChannel and returns the channel result", async () => {
      vi.mocked(restoreChannel).mockResolvedValue(MOCK_CHANNEL_RESULT);
      const caller = makeCaller();
      const result = await caller.channel.restore({ systemId: SYSTEM_ID, channelId: CHANNEL_ID });

      expect(vi.mocked(restoreChannel)).toHaveBeenCalledOnce();
      expect(vi.mocked(restoreChannel).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(restoreChannel).mock.calls[0]?.[2]).toBe(CHANNEL_ID);
      expect(result).toEqual(MOCK_CHANNEL_RESULT);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(restoreChannel).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Channel not found"),
      );
      const caller = makeCaller();
      await expect(
        caller.channel.restore({ systemId: SYSTEM_ID, channelId: CHANNEL_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── delete ────────────────────────────────────────────────────────

  describe("channel.delete", () => {
    it("calls deleteChannel and returns success", async () => {
      vi.mocked(deleteChannel).mockResolvedValue(undefined);
      const caller = makeCaller();
      const result = await caller.channel.delete({ systemId: SYSTEM_ID, channelId: CHANNEL_ID });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(deleteChannel)).toHaveBeenCalledOnce();
      expect(vi.mocked(deleteChannel).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(deleteChannel).mock.calls[0]?.[2]).toBe(CHANNEL_ID);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(deleteChannel).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Channel not found"),
      );
      const caller = makeCaller();
      await expect(
        caller.channel.delete({ systemId: SYSTEM_ID, channelId: CHANNEL_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });
});
