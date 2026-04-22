import { brandId } from "@pluralscape/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../../lib/api-error.js";
import {
  MOCK_SYSTEM_ID,
  makeCallerFactory,
  type SystemId,
  assertProcedureRateLimited,
} from "../test-helpers.js";

import type { FrontingCommentId, FrontingSessionId, UnixMillis } from "@pluralscape/types";

vi.mock("../../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../middleware/rate-limit.js", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
}));

vi.mock("../../../services/fronting-session/comments/create.js", () => ({
  createFrontingComment: vi.fn(),
}));

vi.mock("../../../services/fronting-session/comments/queries.js", () => ({
  getFrontingComment: vi.fn(),
  listFrontingComments: vi.fn(),
}));

vi.mock("../../../services/fronting-session/comments/update.js", () => ({
  updateFrontingComment: vi.fn(),
}));

vi.mock("../../../services/fronting-session/comments/lifecycle.js", () => ({
  archiveFrontingComment: vi.fn(),
  restoreFrontingComment: vi.fn(),
  deleteFrontingComment: vi.fn(),
}));

const { createFrontingComment } =
  await import("../../../services/fronting-session/comments/create.js");
const { getFrontingComment, listFrontingComments } =
  await import("../../../services/fronting-session/comments/queries.js");
const { updateFrontingComment } =
  await import("../../../services/fronting-session/comments/update.js");
const { archiveFrontingComment, restoreFrontingComment, deleteFrontingComment } =
  await import("../../../services/fronting-session/comments/lifecycle.js");

const { frontingCommentRouter } = await import("../../../trpc/routers/fronting-comment.js");

const createCaller = makeCallerFactory({ frontingComment: frontingCommentRouter });

const SESSION_ID = brandId<FrontingSessionId>("fs_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
const COMMENT_ID = brandId<FrontingCommentId>("fcom_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
const VALID_MEMBER_ID = "mem_11111111-2222-3333-4444-555555555555";
const VALID_ENCRYPTED_DATA = "dGVzdGRhdGFmb3JtZW1iZXI=";

const MOCK_COMMENT_RESULT = {
  id: COMMENT_ID,
  frontingSessionId: SESSION_ID,
  systemId: MOCK_SYSTEM_ID,
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
        systemId: MOCK_SYSTEM_ID,
        sessionId: SESSION_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
        memberId: VALID_MEMBER_ID,
        customFrontId: undefined,
        structureEntityId: undefined,
      });

      expect(vi.mocked(createFrontingComment)).toHaveBeenCalledOnce();
      expect(vi.mocked(createFrontingComment).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(createFrontingComment).mock.calls[0]?.[2]).toBe(SESSION_ID);
      expect(result).toEqual(MOCK_COMMENT_RESULT);
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(
        caller.frontingComment.create({
          systemId: MOCK_SYSTEM_ID,
          sessionId: SESSION_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          memberId: VALID_MEMBER_ID,
          customFrontId: undefined,
          structureEntityId: undefined,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));
    });

    it("throws NOT_FOUND when systemId is not owned", async () => {
      const foreignSystemId = brandId<SystemId>("sys_ffffffff-ffff-ffff-ffff-ffffffffffff");
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
          systemId: MOCK_SYSTEM_ID,
          sessionId: brandId<FrontingSessionId>("not-a-session-id"),
          encryptedData: VALID_ENCRYPTED_DATA,
          memberId: VALID_MEMBER_ID,
          customFrontId: undefined,
          structureEntityId: undefined,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });

    it("rejects when no subject id provided", async () => {
      const caller = createCaller();
      await expect(
        caller.frontingComment.create({
          systemId: MOCK_SYSTEM_ID,
          sessionId: SESSION_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          memberId: undefined,
          customFrontId: undefined,
          structureEntityId: undefined,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });
  });

  // ── get ───────────────────────────────────────────────────────────

  describe("frontingComment.get", () => {
    it("calls getFrontingComment with correct ids", async () => {
      vi.mocked(getFrontingComment).mockResolvedValue(MOCK_COMMENT_RESULT);
      const caller = createCaller();
      const result = await caller.frontingComment.get({
        systemId: MOCK_SYSTEM_ID,
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
          systemId: MOCK_SYSTEM_ID,
          sessionId: SESSION_ID,
          commentId: brandId<FrontingCommentId>("not-a-comment-id"),
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
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
        systemId: MOCK_SYSTEM_ID,
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
        systemId: MOCK_SYSTEM_ID,
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
        systemId: MOCK_SYSTEM_ID,
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
        systemId: MOCK_SYSTEM_ID,
        sessionId: SESSION_ID,
        commentId: COMMENT_ID,
      });

      expect(vi.mocked(restoreFrontingComment)).toHaveBeenCalledOnce();
      expect(result).toEqual(MOCK_COMMENT_RESULT);
    });
  });

  // ── delete ────────────────────────────────────────────────────────

  describe("frontingComment.delete", () => {
    it("calls deleteFrontingComment and returns success", async () => {
      vi.mocked(deleteFrontingComment).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.frontingComment.delete({
        systemId: MOCK_SYSTEM_ID,
        sessionId: SESSION_ID,
        commentId: COMMENT_ID,
      });

      expect(vi.mocked(deleteFrontingComment)).toHaveBeenCalledOnce();
      expect(vi.mocked(deleteFrontingComment).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(deleteFrontingComment).mock.calls[0]?.[2]).toBe(SESSION_ID);
      expect(vi.mocked(deleteFrontingComment).mock.calls[0]?.[3]).toBe(COMMENT_ID);
      expect(result).toEqual({ success: true });
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(deleteFrontingComment).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Comment not found"),
      );
      const caller = createCaller();
      await expect(
        caller.frontingComment.delete({
          systemId: MOCK_SYSTEM_ID,
          sessionId: SESSION_ID,
          commentId: COMMENT_ID,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });

    it("surfaces ApiHttpError(403) as FORBIDDEN", async () => {
      vi.mocked(deleteFrontingComment).mockRejectedValue(
        new ApiHttpError(403, "FORBIDDEN", "Access denied"),
      );
      const caller = createCaller();
      await expect(
        caller.frontingComment.delete({
          systemId: MOCK_SYSTEM_ID,
          sessionId: SESSION_ID,
          commentId: COMMENT_ID,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
    });

    it("applies rate limiting", async () => {
      const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
      vi.mocked(deleteFrontingComment).mockResolvedValue(undefined);
      const caller = createCaller();
      await assertProcedureRateLimited(
        vi.mocked(checkRateLimit),
        () =>
          caller.frontingComment.delete({
            systemId: MOCK_SYSTEM_ID,
            sessionId: SESSION_ID,
            commentId: COMMENT_ID,
          }),
        "write",
      );
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
          systemId: MOCK_SYSTEM_ID,
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
          systemId: MOCK_SYSTEM_ID,
          sessionId: SESSION_ID,
          commentId: COMMENT_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          version: 1,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "CONFLICT" }));
    });
  });
  // ── rate limiting ─────────────────────────────────────────────────

  it("applies rate limiting to queries", async () => {
    const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
    vi.mocked(listFrontingComments).mockResolvedValue({
      data: [],
      nextCursor: null,
      hasMore: false,
      totalCount: null,
    });
    const caller = createCaller();
    await assertProcedureRateLimited(
      vi.mocked(checkRateLimit),
      () => caller.frontingComment.list({ systemId: MOCK_SYSTEM_ID, sessionId: SESSION_ID }),
      "readDefault",
    );
  });

  it("applies rate limiting to mutations", async () => {
    const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
    vi.mocked(createFrontingComment).mockResolvedValue(MOCK_COMMENT_RESULT);
    const caller = createCaller();
    await assertProcedureRateLimited(
      vi.mocked(checkRateLimit),
      () =>
        caller.frontingComment.create({
          systemId: MOCK_SYSTEM_ID,
          sessionId: SESSION_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          memberId: VALID_MEMBER_ID,
          customFrontId: undefined,
          structureEntityId: undefined,
        }),
      "write",
    );
  });
});
