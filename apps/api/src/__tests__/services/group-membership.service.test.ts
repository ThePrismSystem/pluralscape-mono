import { PAGINATION, brandId } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fromCursor } from "../../lib/pagination.js";
import { mockDb } from "../helpers/mock-db.js";
import { mockOwnershipFailure } from "../helpers/mock-ownership.js";
import { makeTestAuth } from "../helpers/test-auth.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { GroupId, MemberId, SystemId } from "@pluralscape/types";

vi.mock("../../lib/audit-log.js", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../lib/system-ownership.js", () => ({
  assertSystemOwnership: vi.fn().mockResolvedValue(undefined),
}));

const { addMember, removeMember, listGroupMembers, listMemberGroupMemberships } =
  await import("../../services/group-membership.service.js");
const { assertSystemOwnership } = await import("../../lib/system-ownership.js");

const SYSTEM_ID = brandId<SystemId>("sys_test-system");
const GROUP_ID = brandId<GroupId>("grp_test-group");
const MEMBER_ID = brandId<MemberId>("mem_test-member");

const AUTH = makeTestAuth({
  accountId: "acct_test-account",
  systemId: SYSTEM_ID,
  sessionId: "sess_test-session",
});

const mockAudit = vi.fn().mockResolvedValue(undefined);

function makeMembershipRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    groupId: GROUP_ID,
    memberId: MEMBER_ID,
    systemId: SYSTEM_ID,
    createdAt: 1000,
    ...overrides,
  };
}

describe("addMember", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("adds member to group", async () => {
    const { db, chain } = mockDb();
    // group exists check
    chain.limit.mockResolvedValueOnce([{ id: GROUP_ID }]);
    // member exists check
    chain.limit.mockResolvedValueOnce([{ id: MEMBER_ID }]);
    // insert
    chain.returning.mockResolvedValueOnce([makeMembershipRow()]);

    const result = await addMember(
      db,
      SYSTEM_ID,
      GROUP_ID,
      { memberId: MEMBER_ID },
      AUTH,
      mockAudit,
    );

    expect(result.groupId).toBe(GROUP_ID);
    expect(result.memberId).toBe(MEMBER_ID);
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "group-membership.added" }),
    );
  });

  it("throws 404 when group not found", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]); // group not found

    await expect(
      addMember(db, SYSTEM_ID, GROUP_ID, { memberId: MEMBER_ID }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 404 when member not found", async () => {
    const { db, chain } = mockDb();
    chain.limit
      .mockResolvedValueOnce([{ id: GROUP_ID }]) // group found
      .mockResolvedValueOnce([]); // member not found

    await expect(
      addMember(db, SYSTEM_ID, GROUP_ID, { memberId: MEMBER_ID }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 404 for system ownership failure", async () => {
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    const { db } = mockDb();

    await expect(
      addMember(db, SYSTEM_ID, GROUP_ID, { memberId: MEMBER_ID }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

describe("removeMember", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("removes member from group", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([{ groupId: GROUP_ID }]);

    await removeMember(db, SYSTEM_ID, GROUP_ID, MEMBER_ID, AUTH, mockAudit);

    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "group-membership.removed" }),
    );
  });

  it("throws 404 when membership not found", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]);

    await expect(removeMember(db, SYSTEM_ID, GROUP_ID, MEMBER_ID, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });
});

describe("listGroupMembers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns members for group", async () => {
    const { db, chain } = mockDb();
    // group exists check
    chain.limit.mockResolvedValueOnce([{ id: GROUP_ID }]);
    // member list
    chain.limit.mockResolvedValueOnce([makeMembershipRow()]);

    const result = await listGroupMembers(db, SYSTEM_ID, GROUP_ID, AUTH);

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.memberId).toBe(MEMBER_ID);
  });

  it("throws 404 when group not found", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]); // group not found

    await expect(listGroupMembers(db, SYSTEM_ID, GROUP_ID, AUTH)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });
});

describe("listMemberGroupMemberships", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns group memberships for member", async () => {
    const { db, chain } = mockDb();
    // member exists check
    chain.limit.mockResolvedValueOnce([{ id: MEMBER_ID }]);
    // membership list
    chain.limit.mockResolvedValueOnce([makeMembershipRow()]);

    const result = await listMemberGroupMemberships(db, SYSTEM_ID, MEMBER_ID, AUTH);

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.groupId).toBe(GROUP_ID);
  });

  it("returns empty list when member has no memberships", async () => {
    const { db, chain } = mockDb();
    // member exists check
    chain.limit.mockResolvedValueOnce([{ id: MEMBER_ID }]);
    // membership list — empty
    chain.limit.mockResolvedValueOnce([]);

    const result = await listMemberGroupMemberships(db, SYSTEM_ID, MEMBER_ID, AUTH);

    expect(result.data).toHaveLength(0);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it("throws 404 when member not found", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]); // member not found

    await expect(listMemberGroupMemberships(db, SYSTEM_ID, MEMBER_ID, AUTH)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });

  it("returns hasMore and nextCursor when more results exist", async () => {
    const { db, chain } = mockDb();
    // member exists check
    chain.limit.mockResolvedValueOnce([{ id: MEMBER_ID }]);
    // membership list — returns limit+1 rows (overfetch indicates more)
    chain.limit.mockResolvedValueOnce([
      makeMembershipRow({ groupId: "grp_group-1" }),
      makeMembershipRow({ groupId: "grp_group-2" }),
    ]);

    const result = await listMemberGroupMemberships(db, SYSTEM_ID, MEMBER_ID, AUTH, undefined, 1);

    expect(result.data).toHaveLength(1);
    expect(result.hasMore).toBe(true);
    const { nextCursor } = result;
    expect(nextCursor).not.toBeNull();
    if (nextCursor) {
      expect(fromCursor(nextCursor, PAGINATION.cursorTtlMs)).toBe("grp_group-1");
    }
  });

  it("applies cursor filter when cursor provided", async () => {
    const { db, chain } = mockDb();
    // member exists check
    chain.limit.mockResolvedValueOnce([{ id: MEMBER_ID }]);
    // membership list with cursor applied
    chain.limit.mockResolvedValueOnce([makeMembershipRow({ groupId: "grp_group-3" })]);

    const result = await listMemberGroupMemberships(db, SYSTEM_ID, MEMBER_ID, AUTH, "grp_group-2");

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.groupId).toBe("grp_group-3");
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it("throws 404 for system mismatch (fail-closed privacy)", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]); // ownership check returns no matching system
    const otherAuth: AuthContext = makeTestAuth({
      accountId: "acct_test-account",
      systemId: "sys_other",
      sessionId: "sess_test-session",
    });

    await expect(listMemberGroupMemberships(db, SYSTEM_ID, MEMBER_ID, otherAuth)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });
});
