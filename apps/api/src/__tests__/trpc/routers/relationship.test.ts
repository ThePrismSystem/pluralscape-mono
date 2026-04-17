import { brandId } from "@pluralscape/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../../lib/api-error.js";
import {
  MOCK_SYSTEM_ID,
  makeCallerFactory,
  type SystemId,
  assertProcedureRateLimited,
} from "../test-helpers.js";

import type { MemberId, RelationshipId, UnixMillis } from "@pluralscape/types";

vi.mock("../../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../middleware/rate-limit.js", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
}));

vi.mock("../../../services/relationship.service.js", () => ({
  createRelationship: vi.fn(),
  getRelationship: vi.fn(),
  listRelationships: vi.fn(),
  updateRelationship: vi.fn(),
  archiveRelationship: vi.fn(),
  restoreRelationship: vi.fn(),
  deleteRelationship: vi.fn(),
}));

const {
  createRelationship,
  getRelationship,
  listRelationships,
  updateRelationship,
  archiveRelationship,
  restoreRelationship,
  deleteRelationship,
} = await import("../../../services/relationship.service.js");

const { relationshipRouter } = await import("../../../trpc/routers/relationship.js");

const createCaller = makeCallerFactory({ relationship: relationshipRouter });

const RELATIONSHIP_ID = brandId<RelationshipId>("rel_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
const SOURCE_MEMBER_ID = brandId<MemberId>("mem_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
const TARGET_MEMBER_ID = brandId<MemberId>("mem_bbbbbbbb-cccc-dddd-eeee-ffffffffffff");
const VALID_ENCRYPTED_DATA = "dGVzdGRhdGFmb3JyZWxhdGlvbnNoaXA=";

const MOCK_RELATIONSHIP_RESULT = {
  id: RELATIONSHIP_ID,
  systemId: MOCK_SYSTEM_ID,
  sourceMemberId: SOURCE_MEMBER_ID,
  targetMemberId: TARGET_MEMBER_ID,
  type: "sibling" as const,
  bidirectional: true,
  encryptedData: "base64data==",
  version: 1,
  createdAt: 1_700_000_000_000 as UnixMillis,
  updatedAt: 1_700_000_000_000 as UnixMillis,
  archived: false,
  archivedAt: null,
};

describe("relationship router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── create ───────────────────────────────────────────────────────────

  describe("relationship.create", () => {
    it("calls createRelationship with correct systemId and returns result", async () => {
      vi.mocked(createRelationship).mockResolvedValue(MOCK_RELATIONSHIP_RESULT);
      const caller = createCaller();
      const result = await caller.relationship.create({
        systemId: MOCK_SYSTEM_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
        sourceMemberId: SOURCE_MEMBER_ID,
        targetMemberId: TARGET_MEMBER_ID,
        type: "sibling",
        bidirectional: true,
      });

      expect(vi.mocked(createRelationship)).toHaveBeenCalledOnce();
      expect(vi.mocked(createRelationship).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(result).toEqual(MOCK_RELATIONSHIP_RESULT);
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(
        caller.relationship.create({
          systemId: MOCK_SYSTEM_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          sourceMemberId: SOURCE_MEMBER_ID,
          targetMemberId: TARGET_MEMBER_ID,
          type: "sibling",
          bidirectional: true,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));
    });

    it("throws NOT_FOUND when systemId is not owned", async () => {
      const foreignSystemId = brandId<SystemId>("sys_ffffffff-ffff-ffff-ffff-ffffffffffff");
      const caller = createCaller();
      await expect(
        caller.relationship.create({
          systemId: foreignSystemId,
          encryptedData: VALID_ENCRYPTED_DATA,
          sourceMemberId: SOURCE_MEMBER_ID,
          targetMemberId: TARGET_MEMBER_ID,
          type: "sibling",
          bidirectional: true,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── get ──────────────────────────────────────────────────────────────

  describe("relationship.get", () => {
    it("calls getRelationship with correct systemId and relationshipId", async () => {
      vi.mocked(getRelationship).mockResolvedValue(MOCK_RELATIONSHIP_RESULT);
      const caller = createCaller();
      const result = await caller.relationship.get({
        systemId: MOCK_SYSTEM_ID,
        relationshipId: RELATIONSHIP_ID,
      });

      expect(vi.mocked(getRelationship)).toHaveBeenCalledOnce();
      expect(vi.mocked(getRelationship).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(getRelationship).mock.calls[0]?.[2]).toBe(RELATIONSHIP_ID);
      expect(result).toEqual(MOCK_RELATIONSHIP_RESULT);
    });

    it("rejects invalid relationshipId format", async () => {
      const caller = createCaller();
      await expect(
        caller.relationship.get({
          systemId: MOCK_SYSTEM_ID,
          relationshipId: brandId<RelationshipId>("not-a-relationship-id"),
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(getRelationship).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Relationship not found"),
      );
      const caller = createCaller();
      await expect(
        caller.relationship.get({ systemId: MOCK_SYSTEM_ID, relationshipId: RELATIONSHIP_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── list ─────────────────────────────────────────────────────────────

  describe("relationship.list", () => {
    it("calls listRelationships and returns result", async () => {
      const mockResult = {
        data: [MOCK_RELATIONSHIP_RESULT],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      };
      vi.mocked(listRelationships).mockResolvedValue(mockResult);
      const caller = createCaller();
      const result = await caller.relationship.list({ systemId: MOCK_SYSTEM_ID });

      expect(vi.mocked(listRelationships)).toHaveBeenCalledOnce();
      expect(vi.mocked(listRelationships).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(result).toEqual(mockResult);
    });

    it("passes cursor, limit, memberId, and type", async () => {
      vi.mocked(listRelationships).mockResolvedValue({
        data: [],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      });
      const caller = createCaller();
      await caller.relationship.list({
        systemId: MOCK_SYSTEM_ID,
        cursor: "cursor_abc",
        limit: 10,
        memberId: SOURCE_MEMBER_ID,
        type: "sibling",
      });

      const call = vi.mocked(listRelationships).mock.calls[0];
      expect(call?.[3]).toBe("cursor_abc");
      expect(call?.[4]).toBe(10);
      expect(call?.[5]).toBe(SOURCE_MEMBER_ID);
      expect(call?.[6]).toBe("sibling");
    });
  });

  // ── update ───────────────────────────────────────────────────────────

  describe("relationship.update", () => {
    it("calls updateRelationship with correct systemId and relationshipId", async () => {
      vi.mocked(updateRelationship).mockResolvedValue(MOCK_RELATIONSHIP_RESULT);
      const caller = createCaller();
      const result = await caller.relationship.update({
        systemId: MOCK_SYSTEM_ID,
        relationshipId: RELATIONSHIP_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
        type: "sibling",
        bidirectional: true,
        version: 1,
      });

      expect(vi.mocked(updateRelationship)).toHaveBeenCalledOnce();
      expect(vi.mocked(updateRelationship).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(updateRelationship).mock.calls[0]?.[2]).toBe(RELATIONSHIP_ID);
      expect(result).toEqual(MOCK_RELATIONSHIP_RESULT);
    });

    it("surfaces ApiHttpError(409) as CONFLICT", async () => {
      vi.mocked(updateRelationship).mockRejectedValue(
        new ApiHttpError(409, "CONFLICT", "Version conflict"),
      );
      const caller = createCaller();
      await expect(
        caller.relationship.update({
          systemId: MOCK_SYSTEM_ID,
          relationshipId: RELATIONSHIP_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          type: "sibling",
          bidirectional: true,
          version: 1,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "CONFLICT" }));
    });
  });

  // ── archive ──────────────────────────────────────────────────────────

  describe("relationship.archive", () => {
    it("calls archiveRelationship and returns success", async () => {
      vi.mocked(archiveRelationship).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.relationship.archive({
        systemId: MOCK_SYSTEM_ID,
        relationshipId: RELATIONSHIP_ID,
      });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(archiveRelationship)).toHaveBeenCalledOnce();
      expect(vi.mocked(archiveRelationship).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(archiveRelationship).mock.calls[0]?.[2]).toBe(RELATIONSHIP_ID);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(archiveRelationship).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Relationship not found"),
      );
      const caller = createCaller();
      await expect(
        caller.relationship.archive({ systemId: MOCK_SYSTEM_ID, relationshipId: RELATIONSHIP_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── restore ──────────────────────────────────────────────────────────

  describe("relationship.restore", () => {
    it("calls restoreRelationship and returns result", async () => {
      vi.mocked(restoreRelationship).mockResolvedValue(MOCK_RELATIONSHIP_RESULT);
      const caller = createCaller();
      const result = await caller.relationship.restore({
        systemId: MOCK_SYSTEM_ID,
        relationshipId: RELATIONSHIP_ID,
      });

      expect(vi.mocked(restoreRelationship)).toHaveBeenCalledOnce();
      expect(vi.mocked(restoreRelationship).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(restoreRelationship).mock.calls[0]?.[2]).toBe(RELATIONSHIP_ID);
      expect(result).toEqual(MOCK_RELATIONSHIP_RESULT);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(restoreRelationship).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Relationship not found"),
      );
      const caller = createCaller();
      await expect(
        caller.relationship.restore({ systemId: MOCK_SYSTEM_ID, relationshipId: RELATIONSHIP_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── delete ───────────────────────────────────────────────────────────

  describe("relationship.delete", () => {
    it("calls deleteRelationship and returns success", async () => {
      vi.mocked(deleteRelationship).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.relationship.delete({
        systemId: MOCK_SYSTEM_ID,
        relationshipId: RELATIONSHIP_ID,
      });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(deleteRelationship)).toHaveBeenCalledOnce();
      expect(vi.mocked(deleteRelationship).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(deleteRelationship).mock.calls[0]?.[2]).toBe(RELATIONSHIP_ID);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(deleteRelationship).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Relationship not found"),
      );
      const caller = createCaller();
      await expect(
        caller.relationship.delete({ systemId: MOCK_SYSTEM_ID, relationshipId: RELATIONSHIP_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });
  // ── rate limiting ─────────────────────────────────────────────────

  it("applies rate limiting to queries", async () => {
    const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
    vi.mocked(listRelationships).mockResolvedValue({
      data: [],
      nextCursor: null,
      hasMore: false,
      totalCount: null,
    });
    const caller = createCaller();
    await assertProcedureRateLimited(
      vi.mocked(checkRateLimit),
      () => caller.relationship.list({ systemId: MOCK_SYSTEM_ID }),
      "readDefault",
    );
  });

  it("applies rate limiting to mutations", async () => {
    const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
    vi.mocked(createRelationship).mockResolvedValue(MOCK_RELATIONSHIP_RESULT);
    const caller = createCaller();
    await assertProcedureRateLimited(
      vi.mocked(checkRateLimit),
      () =>
        caller.relationship.create({
          systemId: MOCK_SYSTEM_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          sourceMemberId: SOURCE_MEMBER_ID,
          targetMemberId: TARGET_MEMBER_ID,
          type: "sibling",
          bidirectional: true,
        }),
      "write",
    );
  });
});
