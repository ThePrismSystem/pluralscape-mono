import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../../lib/api-error.js";
import { SYSTEM_ID, makeCallerFactory, type SystemId } from "../test-helpers.js";

import type { BoardMessageId, UnixMillis } from "@pluralscape/types";

vi.mock("../../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../middleware/rate-limit.js", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
}));

vi.mock("../../../services/board-message.service.js", () => ({
  createBoardMessage: vi.fn(),
  getBoardMessage: vi.fn(),
  listBoardMessages: vi.fn(),
  updateBoardMessage: vi.fn(),
  archiveBoardMessage: vi.fn(),
  restoreBoardMessage: vi.fn(),
  deleteBoardMessage: vi.fn(),
  reorderBoardMessages: vi.fn(),
}));

const {
  createBoardMessage,
  getBoardMessage,
  listBoardMessages,
  updateBoardMessage,
  archiveBoardMessage,
  restoreBoardMessage,
  deleteBoardMessage,
  reorderBoardMessages,
} = await import("../../../services/board-message.service.js");

const { boardMessageRouter } = await import("../../../trpc/routers/board-message.js");

const createCaller = makeCallerFactory({ boardMessage: boardMessageRouter });

const BOARD_MESSAGE_ID = "bm_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" as BoardMessageId;
const VALID_ENCRYPTED_DATA = "dGVzdGRhdGFmb3Jib2FyZA==";

const MOCK_BOARD_MESSAGE_RESULT = {
  id: BOARD_MESSAGE_ID,
  systemId: SYSTEM_ID,
  pinned: false,
  sortOrder: 0,
  encryptedData: "base64data==",
  version: 1,
  archived: false,
  archivedAt: null,
  createdAt: 1_700_000_000_000 as UnixMillis,
  updatedAt: 1_700_000_000_000 as UnixMillis,
};

describe("board-message router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── create ────────────────────────────────────────────────────────

  describe("boardMessage.create", () => {
    it("calls createBoardMessage with correct systemId and returns result", async () => {
      vi.mocked(createBoardMessage).mockResolvedValue(MOCK_BOARD_MESSAGE_RESULT);
      const caller = createCaller();
      const result = await caller.boardMessage.create({
        systemId: SYSTEM_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
        sortOrder: 0,
      });

      expect(vi.mocked(createBoardMessage)).toHaveBeenCalledOnce();
      expect(vi.mocked(createBoardMessage).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(result).toEqual(MOCK_BOARD_MESSAGE_RESULT);
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(
        caller.boardMessage.create({
          systemId: SYSTEM_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          sortOrder: 0,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));
    });

    it("throws NOT_FOUND when systemId is not owned", async () => {
      const foreignSystemId = "sys_ffffffff-ffff-ffff-ffff-ffffffffffff" as SystemId;
      const caller = createCaller();
      await expect(
        caller.boardMessage.create({
          systemId: foreignSystemId,
          encryptedData: VALID_ENCRYPTED_DATA,
          sortOrder: 0,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── get ───────────────────────────────────────────────────────────

  describe("boardMessage.get", () => {
    it("calls getBoardMessage with correct systemId and boardMessageId", async () => {
      vi.mocked(getBoardMessage).mockResolvedValue(MOCK_BOARD_MESSAGE_RESULT);
      const caller = createCaller();
      const result = await caller.boardMessage.get({
        systemId: SYSTEM_ID,
        boardMessageId: BOARD_MESSAGE_ID,
      });

      expect(vi.mocked(getBoardMessage)).toHaveBeenCalledOnce();
      expect(vi.mocked(getBoardMessage).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(getBoardMessage).mock.calls[0]?.[2]).toBe(BOARD_MESSAGE_ID);
      expect(result).toEqual(MOCK_BOARD_MESSAGE_RESULT);
    });

    it("rejects invalid boardMessageId format", async () => {
      const caller = createCaller();
      await expect(
        caller.boardMessage.get({
          systemId: SYSTEM_ID,
          boardMessageId: "invalid-id" as BoardMessageId,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(getBoardMessage).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Board message not found"),
      );
      const caller = createCaller();
      await expect(
        caller.boardMessage.get({ systemId: SYSTEM_ID, boardMessageId: BOARD_MESSAGE_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── list ──────────────────────────────────────────────────────────

  describe("boardMessage.list", () => {
    it("calls listBoardMessages and returns result", async () => {
      const mockResult = {
        data: [MOCK_BOARD_MESSAGE_RESULT],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      };
      vi.mocked(listBoardMessages).mockResolvedValue(mockResult);
      const caller = createCaller();
      const result = await caller.boardMessage.list({ systemId: SYSTEM_ID });

      expect(vi.mocked(listBoardMessages)).toHaveBeenCalledOnce();
      expect(vi.mocked(listBoardMessages).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(result).toEqual(mockResult);
    });

    it("passes cursor, limit, and includeArchived as opts", async () => {
      vi.mocked(listBoardMessages).mockResolvedValue({
        data: [],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      });
      const caller = createCaller();
      await caller.boardMessage.list({
        systemId: SYSTEM_ID,
        cursor: "cur_abc",
        limit: 10,
        includeArchived: true,
      });

      const opts = vi.mocked(listBoardMessages).mock.calls[0]?.[3];
      expect(opts?.cursor).toBe("cur_abc");
      expect(opts?.limit).toBe(10);
      expect(opts?.includeArchived).toBe(true);
    });
  });

  // ── update ────────────────────────────────────────────────────────

  describe("boardMessage.update", () => {
    it("calls updateBoardMessage with correct systemId and boardMessageId", async () => {
      vi.mocked(updateBoardMessage).mockResolvedValue(MOCK_BOARD_MESSAGE_RESULT);
      const caller = createCaller();
      const result = await caller.boardMessage.update({
        systemId: SYSTEM_ID,
        boardMessageId: BOARD_MESSAGE_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
        version: 1,
      });

      expect(vi.mocked(updateBoardMessage)).toHaveBeenCalledOnce();
      expect(vi.mocked(updateBoardMessage).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(updateBoardMessage).mock.calls[0]?.[2]).toBe(BOARD_MESSAGE_ID);
      expect(result).toEqual(MOCK_BOARD_MESSAGE_RESULT);
    });

    it("surfaces ApiHttpError(409) as CONFLICT", async () => {
      vi.mocked(updateBoardMessage).mockRejectedValue(
        new ApiHttpError(409, "CONFLICT", "Version mismatch"),
      );
      const caller = createCaller();
      await expect(
        caller.boardMessage.update({
          systemId: SYSTEM_ID,
          boardMessageId: BOARD_MESSAGE_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          version: 1,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "CONFLICT" }));
    });
  });

  // ── archive ───────────────────────────────────────────────────────

  describe("boardMessage.archive", () => {
    it("calls archiveBoardMessage and returns success", async () => {
      vi.mocked(archiveBoardMessage).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.boardMessage.archive({
        systemId: SYSTEM_ID,
        boardMessageId: BOARD_MESSAGE_ID,
      });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(archiveBoardMessage)).toHaveBeenCalledOnce();
      expect(vi.mocked(archiveBoardMessage).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(archiveBoardMessage).mock.calls[0]?.[2]).toBe(BOARD_MESSAGE_ID);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(archiveBoardMessage).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Board message not found"),
      );
      const caller = createCaller();
      await expect(
        caller.boardMessage.archive({ systemId: SYSTEM_ID, boardMessageId: BOARD_MESSAGE_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── restore ───────────────────────────────────────────────────────

  describe("boardMessage.restore", () => {
    it("calls restoreBoardMessage and returns the board message result", async () => {
      vi.mocked(restoreBoardMessage).mockResolvedValue(MOCK_BOARD_MESSAGE_RESULT);
      const caller = createCaller();
      const result = await caller.boardMessage.restore({
        systemId: SYSTEM_ID,
        boardMessageId: BOARD_MESSAGE_ID,
      });

      expect(vi.mocked(restoreBoardMessage)).toHaveBeenCalledOnce();
      expect(vi.mocked(restoreBoardMessage).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(restoreBoardMessage).mock.calls[0]?.[2]).toBe(BOARD_MESSAGE_ID);
      expect(result).toEqual(MOCK_BOARD_MESSAGE_RESULT);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(restoreBoardMessage).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Board message not found"),
      );
      const caller = createCaller();
      await expect(
        caller.boardMessage.restore({ systemId: SYSTEM_ID, boardMessageId: BOARD_MESSAGE_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── delete ────────────────────────────────────────────────────────

  describe("boardMessage.delete", () => {
    it("calls deleteBoardMessage and returns success", async () => {
      vi.mocked(deleteBoardMessage).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.boardMessage.delete({
        systemId: SYSTEM_ID,
        boardMessageId: BOARD_MESSAGE_ID,
      });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(deleteBoardMessage)).toHaveBeenCalledOnce();
      expect(vi.mocked(deleteBoardMessage).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(deleteBoardMessage).mock.calls[0]?.[2]).toBe(BOARD_MESSAGE_ID);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(deleteBoardMessage).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Board message not found"),
      );
      const caller = createCaller();
      await expect(
        caller.boardMessage.delete({ systemId: SYSTEM_ID, boardMessageId: BOARD_MESSAGE_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── reorder ───────────────────────────────────────────────────────

  describe("boardMessage.reorder", () => {
    it("calls reorderBoardMessages and returns success", async () => {
      vi.mocked(reorderBoardMessages).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.boardMessage.reorder({
        systemId: SYSTEM_ID,
        operations: [{ boardMessageId: BOARD_MESSAGE_ID, sortOrder: 1 }],
      });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(reorderBoardMessages)).toHaveBeenCalledOnce();
      expect(vi.mocked(reorderBoardMessages).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND when a board message is missing", async () => {
      vi.mocked(reorderBoardMessages).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Board message(s) not found"),
      );
      const caller = createCaller();
      await expect(
        caller.boardMessage.reorder({
          systemId: SYSTEM_ID,
          operations: [{ boardMessageId: BOARD_MESSAGE_ID, sortOrder: 1 }],
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });

    it("rejects an empty operations array", async () => {
      const caller = createCaller();
      await expect(
        caller.boardMessage.reorder({
          systemId: SYSTEM_ID,
          operations: [],
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });
  });
  // ── rate limiting ─────────────────────────────────────────────────

  it("applies rate limiting to queries", async () => {
    const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
    vi.mocked(checkRateLimit).mockClear();
    vi.mocked(listBoardMessages).mockResolvedValue({
      data: [],
      nextCursor: null,
      hasMore: false,
      totalCount: null,
    });
    const caller = createCaller();
    await caller.boardMessage.list({ systemId: SYSTEM_ID });
    expect(vi.mocked(checkRateLimit)).toHaveBeenCalled();
    const callKey = vi.mocked(checkRateLimit).mock.calls[0]?.[0] as string;
    expect(callKey).toContain("readDefault");
  });
});
