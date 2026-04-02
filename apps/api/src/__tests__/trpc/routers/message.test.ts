import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../../lib/api-error.js";
import { createCallerFactory, router } from "../../../trpc/trpc.js";

import type { AuditWriter } from "../../../lib/audit-writer.js";
import type { AuthContext } from "../../../lib/auth-context.js";
import type { TRPCContext } from "../../../trpc/context.js";
import type {
  AccountId,
  ChannelId,
  MessageId,
  SessionId,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";

vi.mock("../../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../services/message.service.js", () => ({
  createMessage: vi.fn(),
  getMessage: vi.fn(),
  listMessages: vi.fn(),
  updateMessage: vi.fn(),
  archiveMessage: vi.fn(),
  restoreMessage: vi.fn(),
}));

const { createMessage, getMessage, listMessages, updateMessage, archiveMessage, restoreMessage } =
  await import("../../../services/message.service.js");

const { messageRouter } = await import("../../../trpc/routers/message.js");

const SYSTEM_ID = "sys_550e8400-e29b-41d4-a716-446655440000" as SystemId;
const CHANNEL_ID = "ch_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" as ChannelId;
const MESSAGE_ID = "msg_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" as MessageId;
const VALID_ENCRYPTED_DATA = "dGVzdGRhdGFmb3JtZXNzYWdl";
const VALID_TIMESTAMP = 1_700_000_000_000 as UnixMillis;

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
  const appRouter = router({ message: messageRouter });
  const createCaller = createCallerFactory(appRouter);
  return createCaller(makeContext(auth));
}

const MOCK_MESSAGE_RESULT = {
  id: MESSAGE_ID,
  channelId: CHANNEL_ID,
  systemId: SYSTEM_ID,
  replyToId: null,
  timestamp: VALID_TIMESTAMP,
  editedAt: null,
  encryptedData: "base64data==",
  version: 1,
  archived: false,
  archivedAt: null,
  createdAt: VALID_TIMESTAMP,
  updatedAt: VALID_TIMESTAMP,
};

describe("message router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── create ────────────────────────────────────────────────────────

  describe("message.create", () => {
    it("calls createMessage with correct systemId, channelId, and returns result", async () => {
      vi.mocked(createMessage).mockResolvedValue(MOCK_MESSAGE_RESULT);
      const caller = makeCaller();
      const result = await caller.message.create({
        systemId: SYSTEM_ID,
        channelId: CHANNEL_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
        timestamp: VALID_TIMESTAMP,
        replyToId: undefined,
      });

      expect(vi.mocked(createMessage)).toHaveBeenCalledOnce();
      expect(vi.mocked(createMessage).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(createMessage).mock.calls[0]?.[2]).toBe(CHANNEL_ID);
      expect(result).toEqual(MOCK_MESSAGE_RESULT);
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = makeCaller(null);
      await expect(
        caller.message.create({
          systemId: SYSTEM_ID,
          channelId: CHANNEL_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          timestamp: VALID_TIMESTAMP,
          replyToId: undefined,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));
    });

    it("throws NOT_FOUND when systemId is not owned", async () => {
      const foreignSystemId = "sys_ffffffff-ffff-ffff-ffff-ffffffffffff" as SystemId;
      const caller = makeCaller();
      await expect(
        caller.message.create({
          systemId: foreignSystemId,
          channelId: CHANNEL_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          timestamp: VALID_TIMESTAMP,
          replyToId: undefined,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });

    it("rejects invalid channelId format", async () => {
      const caller = makeCaller();
      await expect(
        caller.message.create({
          systemId: SYSTEM_ID,
          channelId: "invalid-id" as ChannelId,
          encryptedData: VALID_ENCRYPTED_DATA,
          timestamp: VALID_TIMESTAMP,
          replyToId: undefined,
        }),
      ).rejects.toThrow();
    });
  });

  // ── get ───────────────────────────────────────────────────────────

  describe("message.get", () => {
    it("calls getMessage with correct systemId and messageId", async () => {
      vi.mocked(getMessage).mockResolvedValue(MOCK_MESSAGE_RESULT);
      const caller = makeCaller();
      const result = await caller.message.get({
        systemId: SYSTEM_ID,
        channelId: CHANNEL_ID,
        messageId: MESSAGE_ID,
      });

      expect(vi.mocked(getMessage)).toHaveBeenCalledOnce();
      expect(vi.mocked(getMessage).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(getMessage).mock.calls[0]?.[2]).toBe(MESSAGE_ID);
      expect(result).toEqual(MOCK_MESSAGE_RESULT);
    });

    it("rejects invalid messageId format", async () => {
      const caller = makeCaller();
      await expect(
        caller.message.get({
          systemId: SYSTEM_ID,
          channelId: CHANNEL_ID,
          messageId: "invalid-id" as MessageId,
        }),
      ).rejects.toThrow();
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(getMessage).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Message not found"),
      );
      const caller = makeCaller();
      await expect(
        caller.message.get({ systemId: SYSTEM_ID, channelId: CHANNEL_ID, messageId: MESSAGE_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── list ──────────────────────────────────────────────────────────

  describe("message.list", () => {
    it("calls listMessages with correct channelId and returns result", async () => {
      const mockResult = {
        data: [MOCK_MESSAGE_RESULT],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      };
      vi.mocked(listMessages).mockResolvedValue(mockResult);
      const caller = makeCaller();
      const result = await caller.message.list({ systemId: SYSTEM_ID, channelId: CHANNEL_ID });

      expect(vi.mocked(listMessages)).toHaveBeenCalledOnce();
      expect(vi.mocked(listMessages).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(listMessages).mock.calls[0]?.[2]).toBe(CHANNEL_ID);
      expect(result).toEqual(mockResult);
    });

    it("passes cursor, limit, and includeArchived as opts", async () => {
      vi.mocked(listMessages).mockResolvedValue({
        data: [],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      });
      const caller = makeCaller();
      await caller.message.list({
        systemId: SYSTEM_ID,
        channelId: CHANNEL_ID,
        cursor: "cur_abc",
        limit: 10,
        includeArchived: true,
      });

      const opts = vi.mocked(listMessages).mock.calls[0]?.[4];
      expect(opts?.cursor).toBe("cur_abc");
      expect(opts?.limit).toBe(10);
      expect(opts?.includeArchived).toBe(true);
    });
  });

  // ── update ────────────────────────────────────────────────────────

  describe("message.update", () => {
    it("calls updateMessage with correct systemId and messageId", async () => {
      vi.mocked(updateMessage).mockResolvedValue(MOCK_MESSAGE_RESULT);
      const caller = makeCaller();
      const result = await caller.message.update({
        systemId: SYSTEM_ID,
        channelId: CHANNEL_ID,
        messageId: MESSAGE_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
        version: 1,
      });

      expect(vi.mocked(updateMessage)).toHaveBeenCalledOnce();
      expect(vi.mocked(updateMessage).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(updateMessage).mock.calls[0]?.[2]).toBe(MESSAGE_ID);
      expect(result).toEqual(MOCK_MESSAGE_RESULT);
    });

    it("surfaces ApiHttpError(409) as CONFLICT", async () => {
      vi.mocked(updateMessage).mockRejectedValue(
        new ApiHttpError(409, "CONFLICT", "Version mismatch"),
      );
      const caller = makeCaller();
      await expect(
        caller.message.update({
          systemId: SYSTEM_ID,
          channelId: CHANNEL_ID,
          messageId: MESSAGE_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          version: 1,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "CONFLICT" }));
    });
  });

  // ── archive ───────────────────────────────────────────────────────

  describe("message.archive", () => {
    it("calls archiveMessage and returns success", async () => {
      vi.mocked(archiveMessage).mockResolvedValue(undefined);
      const caller = makeCaller();
      const result = await caller.message.archive({
        systemId: SYSTEM_ID,
        channelId: CHANNEL_ID,
        messageId: MESSAGE_ID,
      });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(archiveMessage)).toHaveBeenCalledOnce();
      expect(vi.mocked(archiveMessage).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(archiveMessage).mock.calls[0]?.[2]).toBe(MESSAGE_ID);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(archiveMessage).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Message not found"),
      );
      const caller = makeCaller();
      await expect(
        caller.message.archive({
          systemId: SYSTEM_ID,
          channelId: CHANNEL_ID,
          messageId: MESSAGE_ID,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── restore ───────────────────────────────────────────────────────

  describe("message.restore", () => {
    it("calls restoreMessage and returns the message result", async () => {
      vi.mocked(restoreMessage).mockResolvedValue(MOCK_MESSAGE_RESULT);
      const caller = makeCaller();
      const result = await caller.message.restore({
        systemId: SYSTEM_ID,
        channelId: CHANNEL_ID,
        messageId: MESSAGE_ID,
      });

      expect(vi.mocked(restoreMessage)).toHaveBeenCalledOnce();
      expect(vi.mocked(restoreMessage).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(restoreMessage).mock.calls[0]?.[2]).toBe(MESSAGE_ID);
      expect(result).toEqual(MOCK_MESSAGE_RESULT);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(restoreMessage).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Message not found"),
      );
      const caller = makeCaller();
      await expect(
        caller.message.restore({
          systemId: SYSTEM_ID,
          channelId: CHANNEL_ID,
          messageId: MESSAGE_ID,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });
});
