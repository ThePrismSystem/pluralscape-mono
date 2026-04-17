import { brandId } from "@pluralscape/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../../lib/api-error.js";
import {
  MOCK_SYSTEM_ID,
  makeCallerFactory,
  type SystemId,
  assertProcedureRateLimited,
} from "../test-helpers.js";

import type { GroupId, MemberId, UnixMillis } from "@pluralscape/types";

vi.mock("../../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../middleware/rate-limit.js", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
}));

vi.mock("../../../services/group.service.js", () => ({
  createGroup: vi.fn(),
  getGroup: vi.fn(),
  listGroups: vi.fn(),
  updateGroup: vi.fn(),
  deleteGroup: vi.fn(),
  archiveGroup: vi.fn(),
  restoreGroup: vi.fn(),
  moveGroup: vi.fn(),
  copyGroup: vi.fn(),
  getGroupTree: vi.fn(),
  reorderGroups: vi.fn(),
}));

vi.mock("../../../services/group-membership.service.js", () => ({
  addMember: vi.fn(),
  removeMember: vi.fn(),
  listGroupMembers: vi.fn(),
}));

const {
  createGroup,
  getGroup,
  listGroups,
  updateGroup,
  deleteGroup,
  archiveGroup,
  restoreGroup,
  moveGroup,
  copyGroup,
  getGroupTree,
  reorderGroups,
} = await import("../../../services/group.service.js");

const { addMember, removeMember, listGroupMembers } =
  await import("../../../services/group-membership.service.js");

const { groupRouter } = await import("../../../trpc/routers/group.js");

const createCaller = makeCallerFactory({ group: groupRouter });

const GROUP_ID = brandId<GroupId>("grp_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
const MEMBER_ID = brandId<MemberId>("mem_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
const VALID_ENCRYPTED_DATA = "dGVzdGRhdGFmb3JtZW1iZXI=";

const MOCK_GROUP_RESULT = {
  id: GROUP_ID,
  systemId: MOCK_SYSTEM_ID,
  parentGroupId: null,
  sortOrder: 0,
  encryptedData: "base64data==",
  version: 1,
  createdAt: 1_700_000_000_000 as UnixMillis,
  updatedAt: 1_700_000_000_000 as UnixMillis,
  archived: false,
  archivedAt: null,
};

const MOCK_PAGINATED_RESULT = {
  data: [MOCK_GROUP_RESULT],
  nextCursor: null,
  hasMore: false,
  totalCount: null,
};

describe("group router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── create ────────────────────────────────────────────────────────

  describe("group.create", () => {
    it("calls createGroup with correct systemId and returns result", async () => {
      vi.mocked(createGroup).mockResolvedValue(MOCK_GROUP_RESULT);
      const caller = createCaller();
      const result = await caller.group.create({
        systemId: MOCK_SYSTEM_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
        parentGroupId: null,
        sortOrder: 0,
      });

      expect(vi.mocked(createGroup)).toHaveBeenCalledOnce();
      expect(vi.mocked(createGroup).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(result).toEqual(MOCK_GROUP_RESULT);
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(
        caller.group.create({
          systemId: MOCK_SYSTEM_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          parentGroupId: null,
          sortOrder: 0,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));
    });

    it("throws NOT_FOUND when systemId is not owned", async () => {
      const foreignSystemId = brandId<SystemId>("sys_ffffffff-ffff-ffff-ffff-ffffffffffff");
      const caller = createCaller();
      await expect(
        caller.group.create({
          systemId: foreignSystemId,
          encryptedData: VALID_ENCRYPTED_DATA,
          parentGroupId: null,
          sortOrder: 0,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── get ───────────────────────────────────────────────────────────

  describe("group.get", () => {
    it("calls getGroup with correct systemId and groupId", async () => {
      vi.mocked(getGroup).mockResolvedValue(MOCK_GROUP_RESULT);
      const caller = createCaller();
      const result = await caller.group.get({ systemId: MOCK_SYSTEM_ID, groupId: GROUP_ID });

      expect(vi.mocked(getGroup)).toHaveBeenCalledOnce();
      expect(vi.mocked(getGroup).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(getGroup).mock.calls[0]?.[2]).toBe(GROUP_ID);
      expect(result).toEqual(MOCK_GROUP_RESULT);
    });

    it("rejects invalid groupId format", async () => {
      const caller = createCaller();
      await expect(
        caller.group.get({ systemId: MOCK_SYSTEM_ID, groupId: brandId<GroupId>("not-a-group-id") }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(getGroup).mockRejectedValue(new ApiHttpError(404, "NOT_FOUND", "Group not found"));
      const caller = createCaller();
      await expect(
        caller.group.get({ systemId: MOCK_SYSTEM_ID, groupId: GROUP_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── list ──────────────────────────────────────────────────────────

  describe("group.list", () => {
    it("calls listGroups and returns result", async () => {
      vi.mocked(listGroups).mockResolvedValue(MOCK_PAGINATED_RESULT);
      const caller = createCaller();
      const result = await caller.group.list({ systemId: MOCK_SYSTEM_ID });

      expect(vi.mocked(listGroups)).toHaveBeenCalledOnce();
      expect(vi.mocked(listGroups).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(result).toEqual(MOCK_PAGINATED_RESULT);
    });

    it("passes cursor, limit, and includeArchived", async () => {
      vi.mocked(listGroups).mockResolvedValue({
        data: [],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      });
      const caller = createCaller();
      await caller.group.list({
        systemId: MOCK_SYSTEM_ID,
        cursor: "cur_abc",
        limit: 10,
        includeArchived: true,
      });

      const call = vi.mocked(listGroups).mock.calls[0];
      expect(call?.[3]).toBe("cur_abc");
      expect(call?.[4]).toBe(10);
      expect(call?.[5]).toBe(true);
    });

    it("rejects limit above MAX_LIST_LIMIT", async () => {
      const caller = createCaller();
      await expect(caller.group.list({ systemId: MOCK_SYSTEM_ID, limit: 101 })).rejects.toThrow(
        expect.objectContaining({ code: "BAD_REQUEST" }),
      );
    });
  });

  // ── update ────────────────────────────────────────────────────────

  describe("group.update", () => {
    it("calls updateGroup with correct systemId and groupId", async () => {
      vi.mocked(updateGroup).mockResolvedValue(MOCK_GROUP_RESULT);
      const caller = createCaller();
      const result = await caller.group.update({
        systemId: MOCK_SYSTEM_ID,
        groupId: GROUP_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
        version: 1,
      });

      expect(vi.mocked(updateGroup)).toHaveBeenCalledOnce();
      expect(vi.mocked(updateGroup).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(updateGroup).mock.calls[0]?.[2]).toBe(GROUP_ID);
      expect(result).toEqual(MOCK_GROUP_RESULT);
    });

    it("surfaces ApiHttpError(409) as CONFLICT", async () => {
      vi.mocked(updateGroup).mockRejectedValue(
        new ApiHttpError(409, "CONFLICT", "Version mismatch"),
      );
      const caller = createCaller();
      await expect(
        caller.group.update({
          systemId: MOCK_SYSTEM_ID,
          groupId: GROUP_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          version: 1,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "CONFLICT" }));
    });
  });

  // ── delete ────────────────────────────────────────────────────────

  describe("group.delete", () => {
    it("calls deleteGroup and returns success", async () => {
      vi.mocked(deleteGroup).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.group.delete({ systemId: MOCK_SYSTEM_ID, groupId: GROUP_ID });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(deleteGroup)).toHaveBeenCalledOnce();
      expect(vi.mocked(deleteGroup).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(deleteGroup).mock.calls[0]?.[2]).toBe(GROUP_ID);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(deleteGroup).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Group not found"),
      );
      const caller = createCaller();
      await expect(
        caller.group.delete({ systemId: MOCK_SYSTEM_ID, groupId: GROUP_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── archive ───────────────────────────────────────────────────────

  describe("group.archive", () => {
    it("calls archiveGroup and returns success", async () => {
      vi.mocked(archiveGroup).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.group.archive({ systemId: MOCK_SYSTEM_ID, groupId: GROUP_ID });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(archiveGroup)).toHaveBeenCalledOnce();
      expect(vi.mocked(archiveGroup).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(archiveGroup).mock.calls[0]?.[2]).toBe(GROUP_ID);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(archiveGroup).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Group not found"),
      );
      const caller = createCaller();
      await expect(
        caller.group.archive({ systemId: MOCK_SYSTEM_ID, groupId: GROUP_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── restore ───────────────────────────────────────────────────────

  describe("group.restore", () => {
    it("calls restoreGroup and returns result", async () => {
      vi.mocked(restoreGroup).mockResolvedValue(MOCK_GROUP_RESULT);
      const caller = createCaller();
      const result = await caller.group.restore({ systemId: MOCK_SYSTEM_ID, groupId: GROUP_ID });

      expect(vi.mocked(restoreGroup)).toHaveBeenCalledOnce();
      expect(vi.mocked(restoreGroup).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(restoreGroup).mock.calls[0]?.[2]).toBe(GROUP_ID);
      expect(result).toEqual(MOCK_GROUP_RESULT);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(restoreGroup).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Group not found"),
      );
      const caller = createCaller();
      await expect(
        caller.group.restore({ systemId: MOCK_SYSTEM_ID, groupId: GROUP_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── move ──────────────────────────────────────────────────────────

  describe("group.move", () => {
    it("calls moveGroup with correct systemId and groupId", async () => {
      vi.mocked(moveGroup).mockResolvedValue(MOCK_GROUP_RESULT);
      const caller = createCaller();
      const result = await caller.group.move({
        systemId: MOCK_SYSTEM_ID,
        groupId: GROUP_ID,
        targetParentGroupId: null,
        version: 1,
      });

      expect(vi.mocked(moveGroup)).toHaveBeenCalledOnce();
      expect(vi.mocked(moveGroup).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(moveGroup).mock.calls[0]?.[2]).toBe(GROUP_ID);
      expect(result).toEqual(MOCK_GROUP_RESULT);
    });

    it("surfaces ApiHttpError(400) as BAD_REQUEST", async () => {
      vi.mocked(moveGroup).mockRejectedValue(
        new ApiHttpError(400, "VALIDATION_ERROR", "Cycle detected"),
      );
      const caller = createCaller();
      await expect(
        caller.group.move({
          systemId: MOCK_SYSTEM_ID,
          groupId: GROUP_ID,
          targetParentGroupId: null,
          version: 1,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });
  });

  // ── copy ──────────────────────────────────────────────────────────

  describe("group.copy", () => {
    it("calls copyGroup with correct systemId and groupId", async () => {
      vi.mocked(copyGroup).mockResolvedValue(MOCK_GROUP_RESULT);
      const caller = createCaller();
      const result = await caller.group.copy({
        systemId: MOCK_SYSTEM_ID,
        groupId: GROUP_ID,
        copyMemberships: false,
      });

      expect(vi.mocked(copyGroup)).toHaveBeenCalledOnce();
      expect(vi.mocked(copyGroup).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(copyGroup).mock.calls[0]?.[2]).toBe(GROUP_ID);
      expect(result).toEqual(MOCK_GROUP_RESULT);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(copyGroup).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Source group not found"),
      );
      const caller = createCaller();
      await expect(
        caller.group.copy({ systemId: MOCK_SYSTEM_ID, groupId: GROUP_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── getTree ───────────────────────────────────────────────────────

  describe("group.getTree", () => {
    it("calls getGroupTree with correct systemId and returns result", async () => {
      const mockTree = [{ ...MOCK_GROUP_RESULT, children: [] }];
      vi.mocked(getGroupTree).mockResolvedValue(mockTree);
      const caller = createCaller();
      const result = await caller.group.getTree({ systemId: MOCK_SYSTEM_ID });

      expect(vi.mocked(getGroupTree)).toHaveBeenCalledOnce();
      expect(vi.mocked(getGroupTree).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(result).toEqual(mockTree);
    });
  });

  // ── reorder ───────────────────────────────────────────────────────

  describe("group.reorder", () => {
    it("calls reorderGroups and returns success", async () => {
      vi.mocked(reorderGroups).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.group.reorder({
        systemId: MOCK_SYSTEM_ID,
        operations: [{ groupId: GROUP_ID, sortOrder: 0 }],
      });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(reorderGroups)).toHaveBeenCalledOnce();
      expect(vi.mocked(reorderGroups).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(reorderGroups).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Group not found"),
      );
      const caller = createCaller();
      await expect(
        caller.group.reorder({
          systemId: MOCK_SYSTEM_ID,
          operations: [{ groupId: GROUP_ID, sortOrder: 0 }],
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── addMember ─────────────────────────────────────────────────────

  describe("group.addMember", () => {
    it("calls addMember with correct systemId, groupId, and memberId", async () => {
      const mockMembership = {
        groupId: GROUP_ID,
        memberId: MEMBER_ID,
        systemId: MOCK_SYSTEM_ID,
        createdAt: 1_700_000_000_000 as UnixMillis,
      };
      vi.mocked(addMember).mockResolvedValue(mockMembership);
      const caller = createCaller();
      const result = await caller.group.addMember({
        systemId: MOCK_SYSTEM_ID,
        groupId: GROUP_ID,
        memberId: MEMBER_ID,
      });

      expect(vi.mocked(addMember)).toHaveBeenCalledOnce();
      expect(vi.mocked(addMember).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(addMember).mock.calls[0]?.[2]).toBe(GROUP_ID);
      expect(result).toEqual(mockMembership);
    });

    it("surfaces ApiHttpError(409) as CONFLICT when already a member", async () => {
      vi.mocked(addMember).mockRejectedValue(
        new ApiHttpError(409, "CONFLICT", "Already a member of this group"),
      );
      const caller = createCaller();
      await expect(
        caller.group.addMember({
          systemId: MOCK_SYSTEM_ID,
          groupId: GROUP_ID,
          memberId: MEMBER_ID,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "CONFLICT" }));
    });
  });

  // ── removeMember ──────────────────────────────────────────────────

  describe("group.removeMember", () => {
    it("calls removeMember and returns success", async () => {
      vi.mocked(removeMember).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.group.removeMember({
        systemId: MOCK_SYSTEM_ID,
        groupId: GROUP_ID,
        memberId: MEMBER_ID,
      });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(removeMember)).toHaveBeenCalledOnce();
      expect(vi.mocked(removeMember).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(removeMember).mock.calls[0]?.[2]).toBe(GROUP_ID);
      expect(vi.mocked(removeMember).mock.calls[0]?.[3]).toBe(MEMBER_ID);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(removeMember).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Group membership not found"),
      );
      const caller = createCaller();
      await expect(
        caller.group.removeMember({
          systemId: MOCK_SYSTEM_ID,
          groupId: GROUP_ID,
          memberId: MEMBER_ID,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── listMembers ───────────────────────────────────────────────────

  describe("group.listMembers", () => {
    it("calls listGroupMembers and returns result", async () => {
      const mockResult = {
        data: [
          {
            groupId: GROUP_ID,
            memberId: MEMBER_ID,
            systemId: MOCK_SYSTEM_ID,
            createdAt: 1_700_000_000_000 as UnixMillis,
          },
        ],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      };
      vi.mocked(listGroupMembers).mockResolvedValue(mockResult);
      const caller = createCaller();
      const result = await caller.group.listMembers({
        systemId: MOCK_SYSTEM_ID,
        groupId: GROUP_ID,
      });

      expect(vi.mocked(listGroupMembers)).toHaveBeenCalledOnce();
      expect(vi.mocked(listGroupMembers).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(listGroupMembers).mock.calls[0]?.[2]).toBe(GROUP_ID);
      expect(result).toEqual(mockResult);
    });

    it("passes cursor and limit", async () => {
      vi.mocked(listGroupMembers).mockResolvedValue({
        data: [],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      });
      const caller = createCaller();
      await caller.group.listMembers({
        systemId: MOCK_SYSTEM_ID,
        groupId: GROUP_ID,
        cursor: "cur_abc",
        limit: 5,
      });

      const call = vi.mocked(listGroupMembers).mock.calls[0];
      expect(call?.[4]).toBe("cur_abc");
      expect(call?.[5]).toBe(5);
    });
  });
  // ── rate limiting ─────────────────────────────────────────────────

  it("applies rate limiting to queries", async () => {
    const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
    vi.mocked(listGroups).mockResolvedValue({
      data: [],
      nextCursor: null,
      hasMore: false,
      totalCount: null,
    });
    const caller = createCaller();
    await assertProcedureRateLimited(
      vi.mocked(checkRateLimit),
      () => caller.group.list({ systemId: MOCK_SYSTEM_ID }),
      "readDefault",
    );
  });

  it("applies rate limiting to mutations", async () => {
    const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
    vi.mocked(createGroup).mockResolvedValue(MOCK_GROUP_RESULT);
    const caller = createCaller();
    await assertProcedureRateLimited(
      vi.mocked(checkRateLimit),
      () =>
        caller.group.create({
          systemId: MOCK_SYSTEM_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          parentGroupId: null,
          sortOrder: 0,
        }),
      "write",
    );
  });
});
