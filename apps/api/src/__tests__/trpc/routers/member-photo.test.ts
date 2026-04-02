import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../../lib/api-error.js";
import { createCallerFactory, router } from "../../../trpc/trpc.js";

import type { AuditWriter } from "../../../lib/audit-writer.js";
import type { AuthContext } from "../../../lib/auth-context.js";
import type { TRPCContext } from "../../../trpc/context.js";
import type {
  AccountId,
  MemberId,
  MemberPhotoId,
  SessionId,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";

vi.mock("../../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../lib/pagination.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../lib/pagination.js")>();
  return {
    ...actual,
    fromCompositeCursor: vi.fn().mockReturnValue({ id: "mp_cursor", sortValue: 0 }),
  };
});

vi.mock("../../../services/member-photo.service.js", () => ({
  createMemberPhoto: vi.fn(),
  getMemberPhoto: vi.fn(),
  listMemberPhotos: vi.fn(),
  archiveMemberPhoto: vi.fn(),
  restoreMemberPhoto: vi.fn(),
  deleteMemberPhoto: vi.fn(),
  reorderMemberPhotos: vi.fn(),
}));

const {
  createMemberPhoto,
  getMemberPhoto,
  listMemberPhotos,
  archiveMemberPhoto,
  restoreMemberPhoto,
  deleteMemberPhoto,
  reorderMemberPhotos,
} = await import("../../../services/member-photo.service.js");

const { memberPhotoRouter } = await import("../../../trpc/routers/member-photo.js");

const SYSTEM_ID = "sys_550e8400-e29b-41d4-a716-446655440000" as SystemId;
const MEMBER_ID = "mem_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" as MemberId;
const PHOTO_ID = "mp_11111111-2222-3333-4444-555555555555" as MemberPhotoId;
const VALID_ENCRYPTED_DATA = "dGVzdGRhdGFmb3JtZW1iZXI=";

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
  const appRouter = router({ memberPhoto: memberPhotoRouter });
  const createCaller = createCallerFactory(appRouter);
  return createCaller(makeContext(auth));
}

const MOCK_PHOTO_RESULT = {
  id: PHOTO_ID,
  memberId: MEMBER_ID,
  systemId: SYSTEM_ID,
  sortOrder: 0,
  encryptedData: "base64data==",
  version: 1,
  createdAt: 1_700_000_000_000 as UnixMillis,
  updatedAt: 1_700_000_000_000 as UnixMillis,
  archived: false,
  archivedAt: null,
};

describe("memberPhoto router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── create ────────────────────────────────────────────────────────

  describe("memberPhoto.create", () => {
    it("calls createMemberPhoto with correct systemId, memberId, and returns result", async () => {
      vi.mocked(createMemberPhoto).mockResolvedValue(MOCK_PHOTO_RESULT);
      const caller = makeCaller();
      const result = await caller.memberPhoto.create({
        systemId: SYSTEM_ID,
        memberId: MEMBER_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
      });

      expect(vi.mocked(createMemberPhoto)).toHaveBeenCalledOnce();
      expect(vi.mocked(createMemberPhoto).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(createMemberPhoto).mock.calls[0]?.[2]).toBe(MEMBER_ID);
      expect(result).toEqual(MOCK_PHOTO_RESULT);
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = makeCaller(null);
      await expect(
        caller.memberPhoto.create({
          systemId: SYSTEM_ID,
          memberId: MEMBER_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));
    });

    it("rejects invalid memberId format", async () => {
      const caller = makeCaller();
      await expect(
        caller.memberPhoto.create({
          systemId: SYSTEM_ID,
          memberId: "not-a-member-id" as MemberId,
          encryptedData: VALID_ENCRYPTED_DATA,
        }),
      ).rejects.toThrow();
    });
  });

  // ── get ───────────────────────────────────────────────────────────

  describe("memberPhoto.get", () => {
    it("calls getMemberPhoto with correct systemId, memberId, and photoId", async () => {
      vi.mocked(getMemberPhoto).mockResolvedValue(MOCK_PHOTO_RESULT);
      const caller = makeCaller();
      const result = await caller.memberPhoto.get({
        systemId: SYSTEM_ID,
        memberId: MEMBER_ID,
        photoId: PHOTO_ID,
      });

      expect(vi.mocked(getMemberPhoto)).toHaveBeenCalledOnce();
      expect(vi.mocked(getMemberPhoto).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(getMemberPhoto).mock.calls[0]?.[2]).toBe(MEMBER_ID);
      expect(vi.mocked(getMemberPhoto).mock.calls[0]?.[3]).toBe(PHOTO_ID);
      expect(result).toEqual(MOCK_PHOTO_RESULT);
    });

    it("rejects invalid photoId format", async () => {
      const caller = makeCaller();
      await expect(
        caller.memberPhoto.get({
          systemId: SYSTEM_ID,
          memberId: MEMBER_ID,
          photoId: "not-a-photo-id" as MemberPhotoId,
        }),
      ).rejects.toThrow();
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(getMemberPhoto).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Photo not found"),
      );
      const caller = makeCaller();
      await expect(
        caller.memberPhoto.get({ systemId: SYSTEM_ID, memberId: MEMBER_ID, photoId: PHOTO_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── list ──────────────────────────────────────────────────────────

  describe("memberPhoto.list", () => {
    it("calls listMemberPhotos and returns result", async () => {
      const mockResult = {
        data: [MOCK_PHOTO_RESULT],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      };
      vi.mocked(listMemberPhotos).mockResolvedValue(mockResult);
      const caller = makeCaller();
      const result = await caller.memberPhoto.list({ systemId: SYSTEM_ID, memberId: MEMBER_ID });

      expect(vi.mocked(listMemberPhotos)).toHaveBeenCalledOnce();
      expect(vi.mocked(listMemberPhotos).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(listMemberPhotos).mock.calls[0]?.[2]).toBe(MEMBER_ID);
      expect(result).toEqual(mockResult);
    });

    it("decodes cursor and passes limit as opts", async () => {
      vi.mocked(listMemberPhotos).mockResolvedValue({
        data: [],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      });
      const caller = makeCaller();
      await caller.memberPhoto.list({
        systemId: SYSTEM_ID,
        memberId: MEMBER_ID,
        cursor: "cursor_abc",
        limit: 10,
      });

      const opts = vi.mocked(listMemberPhotos).mock.calls[0]?.[4];
      expect(opts?.cursor).toEqual({ id: "mp_cursor", sortValue: 0 });
      expect(opts?.limit).toBe(10);
    });
  });

  // ── archive ───────────────────────────────────────────────────────

  describe("memberPhoto.archive", () => {
    it("calls archiveMemberPhoto with correct args and returns success", async () => {
      vi.mocked(archiveMemberPhoto).mockResolvedValue(undefined);
      const caller = makeCaller();
      const result = await caller.memberPhoto.archive({
        systemId: SYSTEM_ID,
        memberId: MEMBER_ID,
        photoId: PHOTO_ID,
      });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(archiveMemberPhoto)).toHaveBeenCalledOnce();
      expect(vi.mocked(archiveMemberPhoto).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(archiveMemberPhoto).mock.calls[0]?.[2]).toBe(MEMBER_ID);
      expect(vi.mocked(archiveMemberPhoto).mock.calls[0]?.[3]).toBe(PHOTO_ID);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(archiveMemberPhoto).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Photo not found"),
      );
      const caller = makeCaller();
      await expect(
        caller.memberPhoto.archive({ systemId: SYSTEM_ID, memberId: MEMBER_ID, photoId: PHOTO_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── restore ───────────────────────────────────────────────────────

  describe("memberPhoto.restore", () => {
    it("calls restoreMemberPhoto and returns the result", async () => {
      vi.mocked(restoreMemberPhoto).mockResolvedValue(MOCK_PHOTO_RESULT);
      const caller = makeCaller();
      const result = await caller.memberPhoto.restore({
        systemId: SYSTEM_ID,
        memberId: MEMBER_ID,
        photoId: PHOTO_ID,
      });

      expect(vi.mocked(restoreMemberPhoto)).toHaveBeenCalledOnce();
      expect(vi.mocked(restoreMemberPhoto).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(restoreMemberPhoto).mock.calls[0]?.[2]).toBe(MEMBER_ID);
      expect(vi.mocked(restoreMemberPhoto).mock.calls[0]?.[3]).toBe(PHOTO_ID);
      expect(result).toEqual(MOCK_PHOTO_RESULT);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(restoreMemberPhoto).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Photo not found"),
      );
      const caller = makeCaller();
      await expect(
        caller.memberPhoto.restore({ systemId: SYSTEM_ID, memberId: MEMBER_ID, photoId: PHOTO_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── delete ────────────────────────────────────────────────────────

  describe("memberPhoto.delete", () => {
    it("calls deleteMemberPhoto with correct args and returns success", async () => {
      vi.mocked(deleteMemberPhoto).mockResolvedValue(undefined);
      const caller = makeCaller();
      const result = await caller.memberPhoto.delete({
        systemId: SYSTEM_ID,
        memberId: MEMBER_ID,
        photoId: PHOTO_ID,
      });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(deleteMemberPhoto)).toHaveBeenCalledOnce();
      expect(vi.mocked(deleteMemberPhoto).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(deleteMemberPhoto).mock.calls[0]?.[2]).toBe(MEMBER_ID);
      expect(vi.mocked(deleteMemberPhoto).mock.calls[0]?.[3]).toBe(PHOTO_ID);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(deleteMemberPhoto).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Photo not found"),
      );
      const caller = makeCaller();
      await expect(
        caller.memberPhoto.delete({ systemId: SYSTEM_ID, memberId: MEMBER_ID, photoId: PHOTO_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── reorder ───────────────────────────────────────────────────────

  describe("memberPhoto.reorder", () => {
    it("calls reorderMemberPhotos with correct args and returns result", async () => {
      const mockOrdered = [MOCK_PHOTO_RESULT];
      vi.mocked(reorderMemberPhotos).mockResolvedValue(mockOrdered);
      const caller = makeCaller();
      const order = [{ id: PHOTO_ID, sortOrder: 0 }];
      const result = await caller.memberPhoto.reorder({
        systemId: SYSTEM_ID,
        memberId: MEMBER_ID,
        order,
      });

      expect(vi.mocked(reorderMemberPhotos)).toHaveBeenCalledOnce();
      expect(vi.mocked(reorderMemberPhotos).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(reorderMemberPhotos).mock.calls[0]?.[2]).toBe(MEMBER_ID);
      expect(result).toEqual(mockOrdered);
    });

    it("surfaces ApiHttpError(400) as BAD_REQUEST", async () => {
      vi.mocked(reorderMemberPhotos).mockRejectedValue(
        new ApiHttpError(400, "VALIDATION_ERROR", "Invalid reorder"),
      );
      const caller = makeCaller();
      await expect(
        caller.memberPhoto.reorder({
          systemId: SYSTEM_ID,
          memberId: MEMBER_ID,
          order: [{ id: PHOTO_ID, sortOrder: 0 }],
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });
  });
});
