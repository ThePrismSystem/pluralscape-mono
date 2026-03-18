import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../helpers/mock-db.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { MemberId, SystemId } from "@pluralscape/types";

// ── Mock external deps ───────────────────────────────────────────────

vi.mock("@pluralscape/crypto", () => ({
  serializeEncryptedBlob: vi.fn(() => new Uint8Array([1, 2, 3])),
  deserializeEncryptedBlob: vi.fn((data: Uint8Array) => ({
    tier: 1,
    algorithm: "xchacha20-poly1305",
    keyVersion: null,
    bucketId: null,
    nonce: new Uint8Array(24),
    ciphertext: new Uint8Array(data.slice(32)),
  })),
  InvalidInputError: class InvalidInputError extends Error {
    override readonly name = "InvalidInputError" as const;
  },
}));

vi.mock("../../lib/audit-log.js", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../lib/system-ownership.js", () => ({
  assertSystemOwnership: vi.fn().mockResolvedValue(undefined),
}));

// ── Import under test ────────────────────────────────────────────────

const { listAllMemberMemberships } = await import("../../services/member.service.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const SYSTEM_ID = "sys_test-system" as SystemId;
const MEMBER_ID = "mem_test-member" as MemberId;

const AUTH: AuthContext = {
  accountId: "acct_test-account" as AuthContext["accountId"],
  systemId: SYSTEM_ID,
  sessionId: "sess_test-session" as AuthContext["sessionId"],
  accountType: "system",
  ownedSystemIds: new Set([SYSTEM_ID]),
};

// ── Tests ────────────────────────────────────────────────────────────

describe("listAllMemberMemberships", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty arrays when member has no memberships", async () => {
    const { db, chain } = mockDb();
    // Member lookup: select().from().where().limit() -> found
    chain.limit.mockResolvedValueOnce([{ id: MEMBER_ID }]);
    // Four parallel membership queries, each select().from().where() -> empty
    chain.where
      .mockReturnValueOnce(chain) // member lookup chains to .limit()
      .mockResolvedValueOnce([]) // group memberships
      .mockResolvedValueOnce([]) // subsystem memberships
      .mockResolvedValueOnce([]) // side system memberships
      .mockResolvedValueOnce([]); // layer memberships

    const result = await listAllMemberMemberships(db, SYSTEM_ID, MEMBER_ID, AUTH);

    expect(result.groups).toEqual([]);
    expect(result.subsystems).toEqual([]);
    expect(result.sideSystems).toEqual([]);
    expect(result.layers).toEqual([]);
  });

  it("returns group memberships for the member", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: MEMBER_ID }]);
    chain.where
      .mockReturnValueOnce(chain)
      .mockResolvedValueOnce([
        {
          groupId: "grp_group-1",
          memberId: MEMBER_ID,
          systemId: SYSTEM_ID,
          createdAt: 1000,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await listAllMemberMemberships(db, SYSTEM_ID, MEMBER_ID, AUTH);

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.groupId).toBe("grp_group-1");
  });

  it("returns memberships across all structure types", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: MEMBER_ID }]);
    chain.where
      .mockReturnValueOnce(chain)
      .mockResolvedValueOnce([
        { groupId: "grp_g1", memberId: MEMBER_ID, systemId: SYSTEM_ID, createdAt: 1000 },
      ])
      .mockResolvedValueOnce([
        {
          id: "smem_s1",
          subsystemId: "sub_s1",
          memberId: MEMBER_ID,
          systemId: SYSTEM_ID,
          encryptedData: new Uint8Array([1, 2, 3]),
          createdAt: 1000,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "ssmem_ss1",
          sideSystemId: "ss_ss1",
          memberId: MEMBER_ID,
          systemId: SYSTEM_ID,
          encryptedData: new Uint8Array([1, 2, 3]),
          createdAt: 1000,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "lmem_l1",
          layerId: "lay_l1",
          memberId: MEMBER_ID,
          systemId: SYSTEM_ID,
          encryptedData: new Uint8Array([1, 2, 3]),
          createdAt: 1000,
        },
      ]);

    const result = await listAllMemberMemberships(db, SYSTEM_ID, MEMBER_ID, AUTH);

    expect(result.groups).toHaveLength(1);
    expect(result.subsystems).toHaveLength(1);
    expect(result.subsystems[0]?.subsystemId).toBe("sub_s1");
    expect(result.sideSystems).toHaveLength(1);
    expect(result.sideSystems[0]?.sideSystemId).toBe("ss_ss1");
    expect(result.layers).toHaveLength(1);
    expect(result.layers[0]?.layerId).toBe("lay_l1");
  });

  it("throws 404 when member not found", async () => {
    const { db } = mockDb();

    await expect(
      listAllMemberMemberships(db, SYSTEM_ID, "mem_nonexistent" as MemberId, AUTH),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});
