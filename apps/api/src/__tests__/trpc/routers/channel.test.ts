import { brandId } from "@pluralscape/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../../lib/api-error.js";
import {
  MOCK_SYSTEM_ID,
  makeCallerFactory,
  type SystemId,
  assertProcedureRateLimited,
} from "../test-helpers.js";

import type { ChannelId, UnixMillis } from "@pluralscape/types";

vi.mock("../../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../middleware/rate-limit.js", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
}));

vi.mock("../../../services/channel/create.js", () => ({
  createChannel: vi.fn(),
}));
vi.mock("../../../services/channel/queries.js", () => ({
  getChannel: vi.fn(),
  listChannels: vi.fn(),
}));
vi.mock("../../../services/channel/update.js", () => ({
  updateChannel: vi.fn(),
}));
vi.mock("../../../services/channel/delete.js", () => ({
  deleteChannel: vi.fn(),
}));
vi.mock("../../../services/channel/lifecycle.js", () => ({
  archiveChannel: vi.fn(),
  restoreChannel: vi.fn(),
}));

const { createChannel } = await import("../../../services/channel/create.js");
const { getChannel, listChannels } = await import("../../../services/channel/queries.js");
const { updateChannel } = await import("../../../services/channel/update.js");
const { deleteChannel } = await import("../../../services/channel/delete.js");
const { archiveChannel, restoreChannel } = await import("../../../services/channel/lifecycle.js");

const { channelRouter } = await import("../../../trpc/routers/channel.js");

const createCaller = makeCallerFactory({ channel: channelRouter });

const CHANNEL_ID = brandId<ChannelId>("ch_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
const VALID_ENCRYPTED_DATA = "dGVzdGRhdGFmb3JjaGFubmVs";

const MOCK_CHANNEL_RESULT = {
  id: CHANNEL_ID,
  systemId: MOCK_SYSTEM_ID,
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
      const caller = createCaller();
      const result = await caller.channel.create({
        systemId: MOCK_SYSTEM_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
        type: "channel",
        sortOrder: 0,
        parentId: undefined,
      });

      expect(vi.mocked(createChannel)).toHaveBeenCalledOnce();
      expect(vi.mocked(createChannel).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(result).toEqual(MOCK_CHANNEL_RESULT);
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(
        caller.channel.create({
          systemId: MOCK_SYSTEM_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          type: "channel",
          sortOrder: 0,
          parentId: undefined,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));
    });

    it("throws NOT_FOUND when systemId is not owned", async () => {
      const foreignSystemId = brandId<SystemId>("sys_ffffffff-ffff-ffff-ffff-ffffffffffff");
      const caller = createCaller();
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
      const caller = createCaller();
      const result = await caller.channel.get({ systemId: MOCK_SYSTEM_ID, channelId: CHANNEL_ID });

      expect(vi.mocked(getChannel)).toHaveBeenCalledOnce();
      expect(vi.mocked(getChannel).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(getChannel).mock.calls[0]?.[2]).toBe(CHANNEL_ID);
      expect(result).toEqual(MOCK_CHANNEL_RESULT);
    });

    it("rejects invalid channelId format", async () => {
      const caller = createCaller();
      await expect(
        caller.channel.get({
          systemId: MOCK_SYSTEM_ID,
          channelId: brandId<ChannelId>("invalid-id"),
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(getChannel).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Channel not found"),
      );
      const caller = createCaller();
      await expect(
        caller.channel.get({ systemId: MOCK_SYSTEM_ID, channelId: CHANNEL_ID }),
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
      const caller = createCaller();
      const result = await caller.channel.list({ systemId: MOCK_SYSTEM_ID });

      expect(vi.mocked(listChannels)).toHaveBeenCalledOnce();
      expect(vi.mocked(listChannels).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(result).toEqual(mockResult);
    });

    it("passes cursor, limit, and includeArchived as opts", async () => {
      vi.mocked(listChannels).mockResolvedValue({
        data: [],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      });
      const caller = createCaller();
      await caller.channel.list({
        systemId: MOCK_SYSTEM_ID,
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
      const caller = createCaller();
      const result = await caller.channel.update({
        systemId: MOCK_SYSTEM_ID,
        channelId: CHANNEL_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
        version: 1,
      });

      expect(vi.mocked(updateChannel)).toHaveBeenCalledOnce();
      expect(vi.mocked(updateChannel).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(updateChannel).mock.calls[0]?.[2]).toBe(CHANNEL_ID);
      expect(result).toEqual(MOCK_CHANNEL_RESULT);
    });

    it("surfaces ApiHttpError(409) as CONFLICT", async () => {
      vi.mocked(updateChannel).mockRejectedValue(
        new ApiHttpError(409, "CONFLICT", "Version mismatch"),
      );
      const caller = createCaller();
      await expect(
        caller.channel.update({
          systemId: MOCK_SYSTEM_ID,
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
      const caller = createCaller();
      const result = await caller.channel.archive({
        systemId: MOCK_SYSTEM_ID,
        channelId: CHANNEL_ID,
      });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(archiveChannel)).toHaveBeenCalledOnce();
      expect(vi.mocked(archiveChannel).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(archiveChannel).mock.calls[0]?.[2]).toBe(CHANNEL_ID);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(archiveChannel).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Channel not found"),
      );
      const caller = createCaller();
      await expect(
        caller.channel.archive({ systemId: MOCK_SYSTEM_ID, channelId: CHANNEL_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── restore ───────────────────────────────────────────────────────

  describe("channel.restore", () => {
    it("calls restoreChannel and returns the channel result", async () => {
      vi.mocked(restoreChannel).mockResolvedValue(MOCK_CHANNEL_RESULT);
      const caller = createCaller();
      const result = await caller.channel.restore({
        systemId: MOCK_SYSTEM_ID,
        channelId: CHANNEL_ID,
      });

      expect(vi.mocked(restoreChannel)).toHaveBeenCalledOnce();
      expect(vi.mocked(restoreChannel).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(restoreChannel).mock.calls[0]?.[2]).toBe(CHANNEL_ID);
      expect(result).toEqual(MOCK_CHANNEL_RESULT);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(restoreChannel).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Channel not found"),
      );
      const caller = createCaller();
      await expect(
        caller.channel.restore({ systemId: MOCK_SYSTEM_ID, channelId: CHANNEL_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── delete ────────────────────────────────────────────────────────

  describe("channel.delete", () => {
    it("calls deleteChannel and returns success", async () => {
      vi.mocked(deleteChannel).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.channel.delete({
        systemId: MOCK_SYSTEM_ID,
        channelId: CHANNEL_ID,
      });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(deleteChannel)).toHaveBeenCalledOnce();
      expect(vi.mocked(deleteChannel).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(deleteChannel).mock.calls[0]?.[2]).toBe(CHANNEL_ID);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(deleteChannel).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Channel not found"),
      );
      const caller = createCaller();
      await expect(
        caller.channel.delete({ systemId: MOCK_SYSTEM_ID, channelId: CHANNEL_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });
  // ── rate limiting ─────────────────────────────────────────────────

  it("applies rate limiting to queries", async () => {
    const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
    vi.mocked(listChannels).mockResolvedValue({
      data: [],
      nextCursor: null,
      hasMore: false,
      totalCount: null,
    });
    const caller = createCaller();
    await assertProcedureRateLimited(
      vi.mocked(checkRateLimit),
      () => caller.channel.list({ systemId: MOCK_SYSTEM_ID }),
      "readDefault",
    );
  });

  it("applies rate limiting to mutations", async () => {
    const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
    vi.mocked(createChannel).mockResolvedValue(MOCK_CHANNEL_RESULT);
    const caller = createCaller();
    await assertProcedureRateLimited(
      vi.mocked(checkRateLimit),
      () =>
        caller.channel.create({
          systemId: MOCK_SYSTEM_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          type: "channel",
          sortOrder: 0,
          parentId: undefined,
        }),
      "write",
    );
  });
});
