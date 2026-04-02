import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../../lib/api-error.js";
import { SYSTEM_ID, makeCallerFactory, type SystemId } from "../test-helpers.js";

import type { FrontingCommentId, FrontingSessionId, UnixMillis } from "@pluralscape/types";

vi.mock("../../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../services/fronting-comment.service.js", () => ({
  createFrontingComment: vi.fn(),
  getFrontingComment: vi.fn(),
  listFrontingComments: vi.fn(),
  updateFrontingComment: vi.fn(),
  archiveFrontingComment: vi.fn(),
  restoreFrontingComment: vi.fn(),
}));

const {
  createFrontingComment,
  getFrontingComment,
  listFrontingComments,
  updateFrontingComment,
  archiveFrontingComment,
  restoreFrontingComment,
} = await import("../../../services/fronting-comment.service.js");

const { frontingCommentRouter } = await import("../../../trpc/routers/fronting-comment.js");

const createCaller = makeCallerFactory({ frontingComment: frontingCommentRouter });

const SESSION_ID = "fs_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" as FrontingSessionId;
const COMMENT_ID = "fcom_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" as FrontingCommentId;
const VALID_MEMBER_ID = "mem_11111111-2222-3333-4444-555555555555";
const VALID_ENCRYPTED_DATA = "dGVzdGRhdGFmb3JtZW1iZXI=";

const MOCK_COMMENT_RESULT = {
  id: COMMENT_ID,
  frontingSessionId: SESSION_ID,
  systemId: SYSTEM_ID,
  memberId: null,
  customFrontId: null,
  structureEntityId: null,
  encryptedData: "base64data==",
  version: 1,
  archived: false,
  archivedAt: null,
  createdAt: 1_700_000_000_000 as UnixMillis,
  updatedAt: 1_700_000_000_000 as UnixMillis,
};

describe("frontingComment router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── create ────────────────────────────────────────────────────────

  describe("frontingComment.create", () => {
    it("calls createFrontingComment with correct systemId and sessionId", async () => {
      vi.mocked(createFrontingComment).mockResolvedValue(MOCK_COMMENT_RESULT);
      const caller = createCaller();
      const result = await caller.frontingComment.create({
        systemId: SYSTEM_ID,
        sessionId: SESSION_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
        memberId: VALID_MEMBER_ID,
        customFrontId: undefined,
        structureEntityId: undefined,
      });

      expect(vi.mocked(createFrontingComment)).toHaveBeenCalledOnce();
      expect(vi.mocked(createFrontingComment).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(createFrontingComment).mock.calls[0]?.[2]).toBe(SESSION_ID);
      expect(result).toEqual(MOCK_COMMENT_RESULT);
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(
        caller.frontingComment.create({
          systemId: SYSTEM_ID,
          sessionId: SESSION_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          memberId: VALID_MEMBER_ID,
          customFrontId: undefined,
          structureEntityId: undefined,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));
    });

    it("throws NOT_FOUND when systemId is not owned", async () => {
      const foreignSystemId = "sys_ffffffff-ffff-ffff-ffff-ffffffffffff" as SystemId;
      const caller = createCaller();
      await expect(
        caller.frontingComment.create({
          systemId: foreignSystemId,
          sessionId: SESSION_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          memberId: VALID_MEMBER_ID,
          customFrontId: undefined,
          structureEntityId: undefined,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });

    it("rejects invalid sessionId format", async () => {
      const caller = createCaller();
      await expect(
        caller.frontingComment.create({
          systemId: SYSTEM_ID,
          sessionId: "not-a-session-id" as FrontingSessionId,
          encryptedData: VALID_ENCRYPTED_DATA,
          memberId: VALID_MEMBER_ID,
          customFrontId: undefined,
          structureEntityId: undefined,
        }),
      ).rejects.toThrow();
    });

    it("rejects when no subject id provided", async () => {
      const caller = createCaller();
      await expect(
        caller.frontingComment.create({
          systemId: SYSTEM_ID,
          sessionId: SESSION_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          memberId: undefined,
          customFrontId: undefined,
          structureEntityId: undefined,
        }),
      ).rejects.toThrow();
    });
  });

  // ── get ───────────────────────────────────────────────────────────

  describe("frontingComment.get", () => {
    it("calls getFrontingComment with correct ids", async () => {
      vi.mocked(getFrontingComment).mockResolvedValue(MOCK_COMMENT_RESULT);
      const caller = createCaller();
      const result = await caller.frontingComment.get({
        systemId: SYSTEM_ID,
        sessionId: SESSION_ID,
        commentId: COMMENT_ID,
      });

      expect(vi.mocked(getFrontingComment)).toHaveBeenCalledOnce();
      expect(vi.mocked(getFrontingComment).mock.calls[0]?.[2]).toBe(SESSION_ID);
      expect(vi.mocked(getFrontingComment).mock.calls[0]?.[3]).toBe(COMMENT_ID);
      expect(result).toEqual(MOCK_COMMENT_RESULT);
    });

    it("rejects invalid commentId format", async () => {
      const caller = createCaller();
      await expect(
        caller.frontingComment.get({
          systemId: SYSTEM_ID,
          sessionId: SESSION_ID,
          commentId: "not-a-comment-id" as FrontingCommentId,
        }),
      ).rejects.toThrow();
    });
  });

  // ── list ──────────────────────────────────────────────────────────

  describe("frontingComment.list", () => {
    it("calls listFrontingComments with correct sessionId", async () => {
      const mockList = {
        data: [MOCK_COMMENT_RESULT],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      };
      vi.mocked(listFrontingComments).mockResolvedValue(mockList);
      const caller = createCaller();
      const result = await caller.frontingComment.list({
        systemId: SYSTEM_ID,
        sessionId: SESSION_ID,
      });

      expect(vi.mocked(listFrontingComments)).toHaveBeenCalledOnce();
      expect(vi.mocked(listFrontingComments).mock.calls[0]?.[2]).toBe(SESSION_ID);
      expect(result).toEqual(mockList);
    });
  });

  // ── update ────────────────────────────────────────────────────────

  describe("frontingComment.update", () => {
    it("calls updateFrontingComment with correct ids", async () => {
      vi.mocked(updateFrontingComment).mockResolvedValue(MOCK_COMMENT_RESULT);
      const caller = createCaller();
      const result = await caller.frontingComment.update({
        systemId: SYSTEM_ID,
        sessionId: SESSION_ID,
        commentId: COMMENT_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
        version: 1,
      });

      expect(vi.mocked(updateFrontingComment)).toHaveBeenCalledOnce();
      expect(vi.mocked(updateFrontingComment).mock.calls[0]?.[2]).toBe(SESSION_ID);
      expect(vi.mocked(updateFrontingComment).mock.calls[0]?.[3]).toBe(COMMENT_ID);
      expect(result).toEqual(MOCK_COMMENT_RESULT);
    });
  });

  // ── archive ───────────────────────────────────────────────────────

  describe("frontingComment.archive", () => {
    it("calls archiveFrontingComment and returns success", async () => {
      vi.mocked(archiveFrontingComment).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.frontingComment.archive({
        systemId: SYSTEM_ID,
        sessionId: SESSION_ID,
        commentId: COMMENT_ID,
      });

      expect(vi.mocked(archiveFrontingComment)).toHaveBeenCalledOnce();
      expect(result).toEqual({ success: true });
    });
  });

  // ── restore ───────────────────────────────────────────────────────

  describe("frontingComment.restore", () => {
    it("calls restoreFrontingComment and returns result", async () => {
      vi.mocked(restoreFrontingComment).mockResolvedValue(MOCK_COMMENT_RESULT);
      const caller = createCaller();
      const result = await caller.frontingComment.restore({
        systemId: SYSTEM_ID,
        sessionId: SESSION_ID,
        commentId: COMMENT_ID,
      });

      expect(vi.mocked(restoreFrontingComment)).toHaveBeenCalledOnce();
      expect(result).toEqual(MOCK_COMMENT_RESULT);
    });
  });

  // ── error mapping ────────────────────────────────────────────────

  describe("error mapping", () => {
    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(getFrontingComment).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Fronting comment not found"),
      );
      const caller = createCaller();
      await expect(
        caller.frontingComment.get({
          systemId: SYSTEM_ID,
          sessionId: SESSION_ID,
          commentId: COMMENT_ID,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });

    it("surfaces ApiHttpError(409) as CONFLICT", async () => {
      vi.mocked(updateFrontingComment).mockRejectedValue(
        new ApiHttpError(409, "CONFLICT", "Version mismatch"),
      );
      const caller = createCaller();
      await expect(
        caller.frontingComment.update({
          systemId: SYSTEM_ID,
          sessionId: SESSION_ID,
          commentId: COMMENT_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          version: 1,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "CONFLICT" }));
    });
  });
});
