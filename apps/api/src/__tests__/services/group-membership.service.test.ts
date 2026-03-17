import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../helpers/mock-db.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { GroupId, MemberId, SystemId } from "@pluralscape/types";

vi.mock("../../lib/audit-log.js", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

const { addMember, removeMember, listGroupMembers } =
  await import("../../services/group-membership.service.js");

const SYSTEM_ID = "sys_test-system" as SystemId;
const GROUP_ID = "grp_test-group" as GroupId;
const MEMBER_ID = "mem_test-member" as MemberId;

const AUTH: AuthContext = {
  accountId: "acct_test-account" as AuthContext["accountId"],
  systemId: SYSTEM_ID,
  sessionId: "sess_test-session" as AuthContext["sessionId"],
  accountType: "system",
};

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
      expect.anything(),
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

  it("throws 400 for invalid body", async () => {
    const { db } = mockDb();

    await expect(addMember(db, SYSTEM_ID, GROUP_ID, {}, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }),
    );
  });

  it("throws 403 for system mismatch", async () => {
    const { db } = mockDb();
    const otherAuth: AuthContext = { ...AUTH, systemId: "sys_other" as SystemId };

    await expect(
      addMember(db, SYSTEM_ID, GROUP_ID, { memberId: MEMBER_ID }, otherAuth, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 403, code: "FORBIDDEN" }));
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
      expect.anything(),
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

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.memberId).toBe(MEMBER_ID);
  });

  it("throws 404 when group not found", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]); // group not found

    await expect(listGroupMembers(db, SYSTEM_ID, GROUP_ID, AUTH)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });
});
