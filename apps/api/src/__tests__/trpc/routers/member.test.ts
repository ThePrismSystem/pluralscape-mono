import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../../lib/api-error.js";
import { createCallerFactory, router } from "../../../trpc/trpc.js";

import type { AuditWriter } from "../../../lib/audit-writer.js";
import type { AuthContext } from "../../../lib/auth-context.js";
import type { TRPCContext } from "../../../trpc/context.js";
import type { AccountId, MemberId, SessionId, SystemId, UnixMillis } from "@pluralscape/types";

vi.mock("../../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../services/member.service.js", () => ({
  createMember: vi.fn(),
  getMember: vi.fn(),
  listMembers: vi.fn(),
  updateMember: vi.fn(),
  duplicateMember: vi.fn(),
  archiveMember: vi.fn(),
  restoreMember: vi.fn(),
  deleteMember: vi.fn(),
  listAllMemberMemberships: vi.fn(),
}));

const {
  createMember,
  getMember,
  listMembers,
  updateMember,
  duplicateMember,
  archiveMember,
  restoreMember,
  deleteMember,
  listAllMemberMemberships,
} = await import("../../../services/member.service.js");

const { memberRouter } = await import("../../../trpc/routers/member.js");

const SYSTEM_ID = "sys_550e8400-e29b-41d4-a716-446655440000" as SystemId;
const MEMBER_ID = "mem_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" as MemberId;
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
  const appRouter = router({ member: memberRouter });
  const createCaller = createCallerFactory(appRouter);
  return createCaller(makeContext(auth));
}

const MOCK_MEMBER_RESULT = {
  id: MEMBER_ID,
  systemId: SYSTEM_ID,
  encryptedData: "base64data==",
  version: 1,
  createdAt: 1_700_000_000_000 as UnixMillis,
  updatedAt: 1_700_000_000_000 as UnixMillis,
  archived: false,
  archivedAt: null,
};

describe("member router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── create ────────────────────────────────────────────────────────

  describe("member.create", () => {
    it("calls createMember with correct systemId and returns result", async () => {
      vi.mocked(createMember).mockResolvedValue(MOCK_MEMBER_RESULT);
      const caller = makeCaller();
      const result = await caller.member.create({
        systemId: SYSTEM_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
      });

      expect(vi.mocked(createMember)).toHaveBeenCalledOnce();
      expect(vi.mocked(createMember).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(result).toEqual(MOCK_MEMBER_RESULT);
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = makeCaller(null);
      await expect(
        caller.member.create({ systemId: SYSTEM_ID, encryptedData: VALID_ENCRYPTED_DATA }),
      ).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));
    });

    it("throws NOT_FOUND when systemId is not owned", async () => {
      const foreignSystemId = "sys_ffffffff-ffff-ffff-ffff-ffffffffffff" as SystemId;
      const caller = makeCaller();
      await expect(
        caller.member.create({ systemId: foreignSystemId, encryptedData: VALID_ENCRYPTED_DATA }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });

    it("rejects invalid systemId format", async () => {
      const caller = makeCaller();
      await expect(
        caller.member.create({
          systemId: "not-a-system-id" as SystemId,
          encryptedData: VALID_ENCRYPTED_DATA,
        }),
      ).rejects.toThrow();
    });
  });

  // ── get ───────────────────────────────────────────────────────────

  describe("member.get", () => {
    it("calls getMember with correct systemId and memberId", async () => {
      vi.mocked(getMember).mockResolvedValue(MOCK_MEMBER_RESULT);
      const caller = makeCaller();
      const result = await caller.member.get({ systemId: SYSTEM_ID, memberId: MEMBER_ID });

      expect(vi.mocked(getMember)).toHaveBeenCalledOnce();
      expect(vi.mocked(getMember).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(getMember).mock.calls[0]?.[2]).toBe(MEMBER_ID);
      expect(result).toEqual(MOCK_MEMBER_RESULT);
    });

    it("rejects invalid memberId format", async () => {
      const caller = makeCaller();
      await expect(
        caller.member.get({
          systemId: SYSTEM_ID,
          memberId: "not-a-member-id" as MemberId,
        }),
      ).rejects.toThrow();
    });
  });

  // ── error paths ─────────────────────────────────────────────────

  describe("error mapping", () => {
    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(getMember).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Member not found"),
      );
      const caller = makeCaller();
      await expect(caller.member.get({ systemId: SYSTEM_ID, memberId: MEMBER_ID })).rejects.toThrow(
        expect.objectContaining({ code: "NOT_FOUND" }),
      );
    });

    it("surfaces ApiHttpError(409) as CONFLICT", async () => {
      vi.mocked(updateMember).mockRejectedValue(
        new ApiHttpError(409, "CONFLICT", "Version mismatch"),
      );
      const caller = makeCaller();
      await expect(
        caller.member.update({
          systemId: SYSTEM_ID,
          memberId: MEMBER_ID,
          encryptedData: "dGVzdGRhdGFmb3JtZW1iZXI=",
          version: 1,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "CONFLICT" }));
    });

    it("surfaces ApiHttpError(400) as BAD_REQUEST", async () => {
      vi.mocked(createMember).mockRejectedValue(
        new ApiHttpError(400, "VALIDATION_ERROR", "Invalid data"),
      );
      const caller = makeCaller();
      await expect(
        caller.member.create({ systemId: SYSTEM_ID, encryptedData: "dGVzdGRhdGFmb3JtZW1iZXI=" }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });
  });

  // ── list ──────────────────────────────────────────────────────────

  describe("member.list", () => {
    it("calls listMembers and returns result", async () => {
      const mockResult = {
        data: [MOCK_MEMBER_RESULT],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      };
      vi.mocked(listMembers).mockResolvedValue(mockResult);
      const caller = makeCaller();
      const result = await caller.member.list({ systemId: SYSTEM_ID });

      expect(vi.mocked(listMembers)).toHaveBeenCalledOnce();
      expect(vi.mocked(listMembers).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(result).toEqual(mockResult);
    });

    it("passes cursor, limit, groupId, and includeArchived as opts", async () => {
      vi.mocked(listMembers).mockResolvedValue({
        data: [],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      });
      const caller = makeCaller();
      await caller.member.list({
        systemId: SYSTEM_ID,
        cursor: "cur_abc",
        limit: 10,
        groupId: "grp_11111111-2222-3333-4444-555555555555",
        includeArchived: true,
      });

      const opts = vi.mocked(listMembers).mock.calls[0]?.[3];
      expect(opts?.cursor).toBe("cur_abc");
      expect(opts?.limit).toBe(10);
      expect(opts?.groupId).toBe("grp_11111111-2222-3333-4444-555555555555");
      expect(opts?.includeArchived).toBe(true);
    });
  });

  // ── update ────────────────────────────────────────────────────────

  describe("member.update", () => {
    it("calls updateMember with correct systemId and memberId", async () => {
      vi.mocked(updateMember).mockResolvedValue(MOCK_MEMBER_RESULT);
      const caller = makeCaller();
      const result = await caller.member.update({
        systemId: SYSTEM_ID,
        memberId: MEMBER_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
        version: 1,
      });

      expect(vi.mocked(updateMember)).toHaveBeenCalledOnce();
      expect(vi.mocked(updateMember).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(updateMember).mock.calls[0]?.[2]).toBe(MEMBER_ID);
      expect(result).toEqual(MOCK_MEMBER_RESULT);
    });
  });

  // ── archive ───────────────────────────────────────────────────────

  describe("member.archive", () => {
    it("calls archiveMember with correct systemId and memberId", async () => {
      vi.mocked(archiveMember).mockResolvedValue(undefined);
      const caller = makeCaller();
      const result = await caller.member.archive({ systemId: SYSTEM_ID, memberId: MEMBER_ID });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(archiveMember)).toHaveBeenCalledOnce();
      expect(vi.mocked(archiveMember).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(archiveMember).mock.calls[0]?.[2]).toBe(MEMBER_ID);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(archiveMember).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Member not found"),
      );
      const caller = makeCaller();
      await expect(
        caller.member.archive({ systemId: SYSTEM_ID, memberId: MEMBER_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── restore ───────────────────────────────────────────────────────

  describe("member.restore", () => {
    it("calls restoreMember and returns the member result", async () => {
      vi.mocked(restoreMember).mockResolvedValue(MOCK_MEMBER_RESULT);
      const caller = makeCaller();
      const result = await caller.member.restore({ systemId: SYSTEM_ID, memberId: MEMBER_ID });

      expect(vi.mocked(restoreMember)).toHaveBeenCalledOnce();
      expect(vi.mocked(restoreMember).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(restoreMember).mock.calls[0]?.[2]).toBe(MEMBER_ID);
      expect(result).toEqual(MOCK_MEMBER_RESULT);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(restoreMember).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Member not found"),
      );
      const caller = makeCaller();
      await expect(
        caller.member.restore({ systemId: SYSTEM_ID, memberId: MEMBER_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── delete ────────────────────────────────────────────────────────

  describe("member.delete", () => {
    it("calls deleteMember with correct systemId and memberId", async () => {
      vi.mocked(deleteMember).mockResolvedValue(undefined);
      const caller = makeCaller();
      const result = await caller.member.delete({ systemId: SYSTEM_ID, memberId: MEMBER_ID });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(deleteMember)).toHaveBeenCalledOnce();
      expect(vi.mocked(deleteMember).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(deleteMember).mock.calls[0]?.[2]).toBe(MEMBER_ID);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(deleteMember).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Member not found"),
      );
      const caller = makeCaller();
      await expect(
        caller.member.delete({ systemId: SYSTEM_ID, memberId: MEMBER_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── duplicate ─────────────────────────────────────────────────────

  describe("member.duplicate", () => {
    it("calls duplicateMember with correct systemId and memberId", async () => {
      vi.mocked(duplicateMember).mockResolvedValue(MOCK_MEMBER_RESULT);
      const caller = makeCaller();
      const result = await caller.member.duplicate({
        systemId: SYSTEM_ID,
        memberId: MEMBER_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
      });

      expect(vi.mocked(duplicateMember)).toHaveBeenCalledOnce();
      expect(vi.mocked(duplicateMember).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(duplicateMember).mock.calls[0]?.[2]).toBe(MEMBER_ID);
      expect(result).toEqual(MOCK_MEMBER_RESULT);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(duplicateMember).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Member not found"),
      );
      const caller = makeCaller();
      await expect(
        caller.member.duplicate({
          systemId: SYSTEM_ID,
          memberId: MEMBER_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── listMemberships ───────────────────────────────────────────────

  describe("member.listMemberships", () => {
    it("calls listAllMemberMemberships with correct systemId and memberId", async () => {
      const mockResult = { groups: [], structureEntities: [] };
      vi.mocked(listAllMemberMemberships).mockResolvedValue(mockResult);
      const caller = makeCaller();
      const result = await caller.member.listMemberships({
        systemId: SYSTEM_ID,
        memberId: MEMBER_ID,
      });

      expect(vi.mocked(listAllMemberMemberships)).toHaveBeenCalledOnce();
      expect(vi.mocked(listAllMemberMemberships).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(listAllMemberMemberships).mock.calls[0]?.[2]).toBe(MEMBER_ID);
      expect(result).toEqual(mockResult);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(listAllMemberMemberships).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Member not found"),
      );
      const caller = makeCaller();
      await expect(
        caller.member.listMemberships({ systemId: SYSTEM_ID, memberId: MEMBER_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });
});
