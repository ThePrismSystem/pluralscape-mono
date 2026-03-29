import { PAGINATION } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fromCursor } from "../../lib/pagination.js";
import { mockDb } from "../helpers/mock-db.js";
import { mockOwnershipFailure } from "../helpers/mock-ownership.js";
import { makeTestAuth } from "../helpers/test-auth.js";

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

vi.mock("../../services/webhook-dispatcher.js", () => ({
  dispatchWebhookEvent: vi.fn().mockResolvedValue([]),
}));

// ── Import under test ────────────────────────────────────────────────

const { InvalidInputError } = await import("@pluralscape/crypto");
const {
  createMember,
  listMembers,
  getMember,
  updateMember,
  duplicateMember,
  archiveMember,
  restoreMember,
  deleteMember,
} = await import("../../services/member.service.js");
const { assertSystemOwnership } = await import("../../lib/system-ownership.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const SYSTEM_ID = "sys_test-system" as SystemId;
const MEMBER_ID = "mem_test-member" as MemberId;

const AUTH = makeTestAuth({
  accountId: "acct_test-account",
  systemId: SYSTEM_ID,
  sessionId: "sess_test-session",
});

const mockAudit = vi.fn().mockResolvedValue(undefined);

const VALID_BLOB_BASE64 = Buffer.from(new Uint8Array(40)).toString("base64");

function makeMemberRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "mem_test-member",
    systemId: SYSTEM_ID,
    encryptedData: new Uint8Array([1, 2, 3]),
    version: 1,
    createdAt: 1000,
    updatedAt: 1000,
    archived: false,
    archivedAt: null,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe("createMember", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("creates a member and writes audit log", async () => {
    const { db, chain } = mockDb();
    const newRow = makeMemberRow();
    chain.returning.mockResolvedValueOnce([newRow]);

    const result = await createMember(
      db,
      SYSTEM_ID,
      { encryptedData: VALID_BLOB_BASE64 },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe("mem_test-member");
    expect(result.version).toBe(1);
    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "member.created" }),
    );
  });

  it("throws 400 for invalid body", async () => {
    const { db } = mockDb();

    await expect(createMember(db, SYSTEM_ID, { invalid: true }, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }),
    );
  });

  it("throws 400 for oversized blob", async () => {
    const { db } = mockDb();
    // String exceeds zod max length (131_072 chars), so validation rejects first
    const oversized = "A".repeat(131_073);

    await expect(
      createMember(db, SYSTEM_ID, { encryptedData: oversized }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("throws 400 for malformed blob", async () => {
    const { db } = mockDb();
    const { deserializeEncryptedBlob } = await import("@pluralscape/crypto");
    vi.mocked(deserializeEncryptedBlob).mockImplementationOnce(() => {
      throw new InvalidInputError("Invalid blob");
    });

    await expect(
      createMember(db, SYSTEM_ID, { encryptedData: VALID_BLOB_BASE64 }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("rejects cross-system access", async () => {
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    const { db } = mockDb();
    await expect(
      createMember(db, SYSTEM_ID, { encryptedData: VALID_BLOB_BASE64 }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

describe("listMembers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("returns empty page when no members exist", async () => {
    const { db } = mockDb();

    const result = await listMembers(db, SYSTEM_ID, AUTH);

    expect(result.items).toEqual([]);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
    expect(result.totalCount).toBeNull();
  });

  it("returns members for the system", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeMemberRow()]);

    const result = await listMembers(db, SYSTEM_ID, AUTH);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe("mem_test-member");
    expect(result.hasMore).toBe(false);
  });

  it("detects hasMore when more rows than limit", async () => {
    const { db, chain } = mockDb();
    const rows = [makeMemberRow({ id: "mem_a" }), makeMemberRow({ id: "mem_b" })];
    chain.limit.mockResolvedValueOnce(rows);

    const result = await listMembers(db, SYSTEM_ID, AUTH, { limit: 1 });

    expect(result.items).toHaveLength(1);
    expect(result.hasMore).toBe(true);
    const { nextCursor } = result;
    expect(nextCursor).not.toBeNull();
    if (nextCursor) {
      expect(fromCursor(nextCursor, PAGINATION.cursorTtlMs)).toBe("mem_a");
    }
  });

  it("caps limit to MAX_MEMBER_LIMIT", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    await listMembers(db, SYSTEM_ID, AUTH, { limit: 999 });

    // MAX_MEMBER_LIMIT + 1 = 101
    expect(chain.limit).toHaveBeenCalledWith(101);
  });

  it("uses default limit when not specified", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    await listMembers(db, SYSTEM_ID, AUTH);

    // DEFAULT_MEMBER_LIMIT + 1 = 26
    expect(chain.limit).toHaveBeenCalledWith(26);
  });

  it("applies cursor filter when cursor provided", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    await listMembers(db, SYSTEM_ID, AUTH, { cursor: "mem_cursor-id" });

    expect(chain.where).toHaveBeenCalled();
  });

  it("includes archived members when includeArchived is true", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeMemberRow({ archived: true, archivedAt: 2000 })]);

    const result = await listMembers(db, SYSTEM_ID, AUTH, { includeArchived: true });

    expect(result.items).toHaveLength(1);
    expect(chain.where).toHaveBeenCalled();
  });
});

describe("getMember", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("returns member when found", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeMemberRow()]);

    const result = await getMember(db, SYSTEM_ID, MEMBER_ID, AUTH);

    expect(result.id).toBe("mem_test-member");
    expect(result.version).toBe(1);
  });

  it("throws 404 when member not found", async () => {
    const { db } = mockDb();

    await expect(getMember(db, SYSTEM_ID, "mem_nonexistent" as MemberId, AUTH)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });
});

describe("updateMember", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("updates member with version increment", async () => {
    const { db, chain } = mockDb();
    const updatedRow = makeMemberRow({ version: 2, encryptedData: new Uint8Array([1, 2, 3]) });
    chain.returning.mockResolvedValueOnce([updatedRow]);

    const result = await updateMember(
      db,
      SYSTEM_ID,
      MEMBER_ID,
      { encryptedData: VALID_BLOB_BASE64, version: 1 },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe("mem_test-member");
    expect(result.version).toBe(2);
    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "member.updated" }),
    );
  });

  it("throws 409 on version conflict", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]);
    // Follow-up SELECT finds the member (= conflict, not 404)
    chain.limit.mockResolvedValueOnce([{ id: "mem_test-member" }]);

    await expect(
      updateMember(
        db,
        SYSTEM_ID,
        MEMBER_ID,
        { encryptedData: VALID_BLOB_BASE64, version: 1 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 409, code: "CONFLICT" }));
  });

  it("throws 404 when member not found", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]);
    chain.limit.mockResolvedValueOnce([]);

    await expect(
      updateMember(
        db,
        SYSTEM_ID,
        "mem_nonexistent" as MemberId,
        { encryptedData: VALID_BLOB_BASE64, version: 1 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 400 for invalid body (missing version)", async () => {
    const { db } = mockDb();

    await expect(
      updateMember(db, SYSTEM_ID, MEMBER_ID, { encryptedData: VALID_BLOB_BASE64 }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("throws 400 for oversized blob", async () => {
    const { db } = mockDb();
    // String exceeds zod max length (131_072 chars), so validation rejects first
    const oversized = "A".repeat(131_073);

    await expect(
      updateMember(
        db,
        SYSTEM_ID,
        MEMBER_ID,
        { encryptedData: oversized, version: 1 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });
});

describe("duplicateMember", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("duplicates a member successfully", async () => {
    const { db, chain } = mockDb();
    // Source member lookup: select().from().where().limit() → found
    chain.limit.mockResolvedValueOnce([makeMemberRow()]);
    // Insert new member: insert().values().returning() → new row
    const newRow = makeMemberRow({ id: "mem_new-member" });
    chain.returning.mockResolvedValueOnce([newRow]);

    const result = await duplicateMember(
      db,
      SYSTEM_ID,
      MEMBER_ID,
      { encryptedData: VALID_BLOB_BASE64 },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe("mem_new-member");
    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "member.duplicated" }),
    );
  });

  it("throws 404 when source member not found", async () => {
    const { db } = mockDb();

    await expect(
      duplicateMember(
        db,
        SYSTEM_ID,
        "mem_nonexistent" as MemberId,
        { encryptedData: VALID_BLOB_BASE64 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("copies photos when copyPhotos is true", async () => {
    const { db, chain } = mockDb();
    // Source member lookup inside tx: tx.select().from(members).where().limit(1)
    chain.limit.mockResolvedValueOnce([makeMemberRow()]);
    // Insert new member in tx: tx.insert().values().returning()
    const newRow = makeMemberRow({ id: "mem_new-member" });
    chain.returning.mockResolvedValueOnce([newRow]);
    // Photos select in tx: tx.select().from(memberPhotos).where() — terminal (no .limit())
    chain.where
      .mockReturnValueOnce(chain) // source member → chains to .limit()
      .mockResolvedValueOnce([
        {
          id: "mphoto_existing",
          memberId: MEMBER_ID,
          systemId: SYSTEM_ID,
          sortOrder: 0,
          encryptedData: new Uint8Array([4, 5, 6]),
          archived: false,
        },
      ]);
    // Photo copy insert: tx.insert().values().returning({ id })
    chain.returning.mockResolvedValueOnce([{ id: "mphoto_new" }]);

    const result = await duplicateMember(
      db,
      SYSTEM_ID,
      MEMBER_ID,
      { encryptedData: VALID_BLOB_BASE64, copyPhotos: true },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe("mem_new-member");
    expect(chain.insert).toHaveBeenCalledTimes(2); // member + photo
  });

  it("copies field values when copyFields is true", async () => {
    const { db, chain } = mockDb();
    // Source member lookup inside tx: tx.select().from(members).where().limit(1)
    chain.limit.mockResolvedValueOnce([makeMemberRow()]);
    // Insert new member in tx: tx.insert().values().returning()
    const newRow = makeMemberRow({ id: "mem_new-member" });
    chain.returning.mockResolvedValueOnce([newRow]);
    // Field values select in tx: tx.select().from(fieldValues).where() — terminal
    chain.where
      .mockReturnValueOnce(chain) // source member → chains to .limit()
      .mockResolvedValueOnce([
        {
          id: "fval_existing",
          fieldDefinitionId: "fdef_test",
          memberId: MEMBER_ID,
          systemId: SYSTEM_ID,
          encryptedData: new Uint8Array([7, 8, 9]),
        },
      ]);
    // Field value copy insert: tx.insert().values().returning({ id })
    chain.returning.mockResolvedValueOnce([{ id: "fval_new" }]);

    const result = await duplicateMember(
      db,
      SYSTEM_ID,
      MEMBER_ID,
      { encryptedData: VALID_BLOB_BASE64, copyFields: true },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe("mem_new-member");
    // Verify insert was called for the field value copy
    expect(chain.insert).toHaveBeenCalledTimes(2); // member + field value
  });

  it("copies group memberships when copyMemberships is true", async () => {
    const { db, chain } = mockDb();
    // Source member lookup inside tx: tx.select().from(members).where().limit(1)
    chain.limit.mockResolvedValueOnce([makeMemberRow()]);
    // Insert new member in tx: tx.insert().values().returning()
    const newRow = makeMemberRow({ id: "mem_new-member" });
    chain.returning.mockResolvedValueOnce([newRow]);
    // Group memberships select in tx: tx.select().from(groupMemberships).where() — terminal
    chain.where
      .mockReturnValueOnce(chain) // source member → chains to .limit()
      .mockResolvedValueOnce([
        {
          groupId: "grp_group-1",
          memberId: MEMBER_ID,
          systemId: SYSTEM_ID,
          createdAt: 1000,
        },
        {
          groupId: "grp_group-2",
          memberId: MEMBER_ID,
          systemId: SYSTEM_ID,
          createdAt: 1000,
        },
      ]);
    // Membership copy insert: tx.insert().values().returning()
    chain.returning.mockResolvedValueOnce([{ groupId: "grp_group-1" }, { groupId: "grp_group-2" }]);

    const result = await duplicateMember(
      db,
      SYSTEM_ID,
      MEMBER_ID,
      { encryptedData: VALID_BLOB_BASE64, copyMemberships: true },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe("mem_new-member");
    expect(chain.insert).toHaveBeenCalledTimes(2); // member + memberships
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({
        eventType: "member.duplicated",
        detail: expect.stringContaining("2 membership(s) copied"),
      }),
    );
  });

  it("skips membership copy when source has no memberships", async () => {
    const { db, chain } = mockDb();
    // Source member lookup
    chain.limit.mockResolvedValueOnce([makeMemberRow()]);
    // Insert new member
    const newRow = makeMemberRow({ id: "mem_new-member" });
    chain.returning.mockResolvedValueOnce([newRow]);
    // Group memberships select — empty
    chain.where
      .mockReturnValueOnce(chain) // source member → chains to .limit()
      .mockResolvedValueOnce([]);

    const result = await duplicateMember(
      db,
      SYSTEM_ID,
      MEMBER_ID,
      { encryptedData: VALID_BLOB_BASE64, copyMemberships: true },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe("mem_new-member");
    expect(chain.insert).toHaveBeenCalledTimes(1); // only member, no memberships
  });

  it("throws 400 for invalid duplicate payload", async () => {
    const { db } = mockDb();

    await expect(
      duplicateMember(db, SYSTEM_ID, MEMBER_ID, { invalid: true }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });
});

describe("archiveMember", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("archives member and cascades to photos but preserves field values", async () => {
    const { db, chain } = mockDb();
    // 1. tx.select().from().where().limit() → find member
    chain.limit.mockResolvedValueOnce([{ id: "mem_test-member" }]);
    // 2. tx.update(memberPhotos).set().where() → cascade archive photos (where resolves chain)
    // 3. audit(tx, ...) → mockAudit handles this
    // 4. tx.update(members).set().where() → archive member (where resolves chain)

    await archiveMember(db, SYSTEM_ID, MEMBER_ID, AUTH, mockAudit);

    expect(chain.transaction).toHaveBeenCalled();
    expect(chain.update).toHaveBeenCalled();
    // Field values must NOT be deleted during archival (audit S-6 fix)
    expect(chain.delete).not.toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({
        eventType: "member.archived",
        detail: expect.stringContaining("field values preserved"),
      }),
    );
  });

  it("throws 404 when member not found", async () => {
    const { db } = mockDb();

    await expect(
      archiveMember(db, SYSTEM_ID, "mem_nonexistent" as MemberId, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

describe("restoreMember", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("restores an archived member", async () => {
    const { db, chain } = mockDb();
    // Find archived member
    chain.limit.mockResolvedValueOnce([makeMemberRow({ archived: true, archivedAt: 2000 })]);
    // Update returning
    const restoredRow = makeMemberRow({ archived: false, archivedAt: null });
    chain.returning.mockResolvedValueOnce([restoredRow]);

    const result = await restoreMember(db, SYSTEM_ID, MEMBER_ID, AUTH, mockAudit);

    expect(result.id).toBe("mem_test-member");
    expect(result.archived).toBe(false);
    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "member.restored" }),
    );
  });

  it("throws 404 when member not found", async () => {
    const { db } = mockDb();

    await expect(
      restoreMember(db, SYSTEM_ID, "mem_nonexistent" as MemberId, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

describe("deleteMember", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("deletes member with no dependents", async () => {
    const { db, chain } = mockDb();
    // 1. tx.select({ id }).from(members).where().limit(1) → find member
    //    where() must return chain so .limit() can be called
    chain.where.mockReturnValueOnce(chain);
    chain.limit.mockResolvedValueOnce([{ id: "mem_test-member" }]);
    // Dependent count queries (11 tables checked in parallel)
    chain.where.mockResolvedValueOnce([{ count: 0 }]); // 1. memberPhotos
    chain.where.mockResolvedValueOnce([{ count: 0 }]); // 2. fieldValues
    chain.where.mockResolvedValueOnce([{ count: 0 }]); // 3. groupMemberships
    chain.where.mockResolvedValueOnce([{ count: 0 }]); // 4. frontingSessions
    chain.where.mockResolvedValueOnce([{ count: 0 }]); // 5. relationships
    chain.where.mockResolvedValueOnce([{ count: 0 }]); // 6. notes
    chain.where.mockResolvedValueOnce([{ count: 0 }]); // 7. frontingComments
    chain.where.mockResolvedValueOnce([{ count: 0 }]); // 8. checkInRecords
    chain.where.mockResolvedValueOnce([{ count: 0 }]); // 9. polls
    chain.where.mockResolvedValueOnce([{ count: 0 }]); // 10. acknowledgements
    chain.where.mockResolvedValueOnce([{ count: 0 }]); // 11. systemStructureEntityMemberLinks
    // tx.delete(members).where() → chain (no return value needed)

    await deleteMember(db, SYSTEM_ID, MEMBER_ID, AUTH, mockAudit);

    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "member.deleted" }),
    );
    expect(chain.delete).toHaveBeenCalled();
  });

  it("throws 404 when member not found", async () => {
    const { db } = mockDb();

    await expect(
      deleteMember(db, SYSTEM_ID, "mem_nonexistent" as MemberId, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 409 HAS_DEPENDENTS when member has photos", async () => {
    const { db, chain } = mockDb();
    // Find member: where() chains to .limit()
    chain.where.mockReturnValueOnce(chain);
    chain.limit.mockResolvedValueOnce([{ id: "mem_test-member" }]);
    // Dependent count queries (11 tables checked in parallel)
    chain.where.mockResolvedValueOnce([{ count: 3 }]); // 1. memberPhotos
    chain.where.mockResolvedValueOnce([{ count: 0 }]); // 2. fieldValues
    chain.where.mockResolvedValueOnce([{ count: 0 }]); // 3. groupMemberships
    chain.where.mockResolvedValueOnce([{ count: 0 }]); // 4. frontingSessions
    chain.where.mockResolvedValueOnce([{ count: 0 }]); // 5. relationships
    chain.where.mockResolvedValueOnce([{ count: 0 }]); // 6. notes
    chain.where.mockResolvedValueOnce([{ count: 0 }]); // 7. frontingComments
    chain.where.mockResolvedValueOnce([{ count: 0 }]); // 8. checkInRecords
    chain.where.mockResolvedValueOnce([{ count: 0 }]); // 9. polls
    chain.where.mockResolvedValueOnce([{ count: 0 }]); // 10. acknowledgements
    chain.where.mockResolvedValueOnce([{ count: 0 }]); // 11. systemStructureEntityMemberLinks

    await expect(deleteMember(db, SYSTEM_ID, MEMBER_ID, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({
        status: 409,
        code: "HAS_DEPENDENTS",
      }),
    );
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it("throws 409 HAS_DEPENDENTS with multiple dependent types", async () => {
    const { db, chain } = mockDb();
    // Find member: where() chains to .limit()
    chain.where.mockReturnValueOnce(chain);
    chain.limit.mockResolvedValueOnce([{ id: "mem_test-member" }]);
    // photos=2, fieldValues=5, groupMemberships=0, frontingSessions=1,
    // relationships=0, notes=3, frontingComments=0, checkInRecords=0, polls=0, acknowledgements=0, structureEntityMemberLinks=0
    chain.where
      .mockResolvedValueOnce([{ count: 2 }]) // photos
      .mockResolvedValueOnce([{ count: 5 }]) // fieldValues
      .mockResolvedValueOnce([{ count: 0 }]) // groupMemberships
      .mockResolvedValueOnce([{ count: 1 }]) // frontingSessions
      .mockResolvedValueOnce([{ count: 0 }]) // relationships
      .mockResolvedValueOnce([{ count: 3 }]) // notes
      .mockResolvedValueOnce([{ count: 0 }]) // frontingComments
      .mockResolvedValueOnce([{ count: 0 }]) // checkInRecords
      .mockResolvedValueOnce([{ count: 0 }]) // polls
      .mockResolvedValueOnce([{ count: 0 }]) // acknowledgements
      .mockResolvedValueOnce([{ count: 0 }]); // structureEntityMemberLinks

    try {
      await deleteMember(db, SYSTEM_ID, MEMBER_ID, AUTH, mockAudit);
      expect.unreachable("Should have thrown");
    } catch (err: unknown) {
      const error = err as {
        status: number;
        code: string;
        details: { dependents: { type: string; count: number }[] };
      };
      expect(error.status).toBe(409);
      expect(error.code).toBe("HAS_DEPENDENTS");
      expect(error.details.dependents).toEqual([
        { type: "photos", count: 2 },
        { type: "fieldValues", count: 5 },
        { type: "frontingSessions", count: 1 },
        { type: "notes", count: 3 },
      ]);
    }
    expect(mockAudit).not.toHaveBeenCalled();
    expect(chain.delete).not.toHaveBeenCalled();
  });

  it("throws 409 HAS_DEPENDENTS for relationships", async () => {
    const { db, chain } = mockDb();
    // Find member: where() chains to .limit()
    chain.where.mockReturnValueOnce(chain);
    chain.limit.mockResolvedValueOnce([{ id: "mem_test-member" }]);
    // All zero except relationships
    chain.where
      .mockResolvedValueOnce([{ count: 0 }]) // photos
      .mockResolvedValueOnce([{ count: 0 }]) // fieldValues
      .mockResolvedValueOnce([{ count: 0 }]) // groupMemberships
      .mockResolvedValueOnce([{ count: 0 }]) // frontingSessions
      .mockResolvedValueOnce([{ count: 2 }]) // relationships
      .mockResolvedValueOnce([{ count: 0 }]) // notes
      .mockResolvedValueOnce([{ count: 0 }]) // frontingComments
      .mockResolvedValueOnce([{ count: 0 }]) // checkInRecords
      .mockResolvedValueOnce([{ count: 0 }]) // polls
      .mockResolvedValueOnce([{ count: 0 }]) // acknowledgements
      .mockResolvedValueOnce([{ count: 0 }]); // structureEntityMemberLinks

    try {
      await deleteMember(db, SYSTEM_ID, MEMBER_ID, AUTH, mockAudit);
      expect.unreachable("Should have thrown");
    } catch (err: unknown) {
      const error = err as {
        status: number;
        code: string;
        details: { dependents: { type: string; count: number }[] };
      };
      expect(error.status).toBe(409);
      expect(error.code).toBe("HAS_DEPENDENTS");
      expect(error.details.dependents).toEqual([{ type: "relationships", count: 2 }]);
    }
  });

  it("rejects cross-system access", async () => {
    const { ApiHttpError } = await import("../../lib/api-error.js");
    vi.mocked(assertSystemOwnership).mockImplementationOnce(() => {
      throw new ApiHttpError(403, "FORBIDDEN", "System ownership check failed");
    });
    const { db } = mockDb();

    await expect(deleteMember(db, SYSTEM_ID, MEMBER_ID, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({ status: 403, code: "FORBIDDEN" }),
    );
  });

  it("throws 409 HAS_DEPENDENTS for acknowledgements", async () => {
    const { db, chain } = mockDb();
    // Find member: where() chains to .limit()
    chain.where.mockReturnValueOnce(chain);
    chain.limit.mockResolvedValueOnce([{ id: "mem_test-member" }]);
    // Dependent count queries (11 tables checked in parallel)
    chain.where.mockResolvedValueOnce([{ count: 0 }]); // 1. memberPhotos
    chain.where.mockResolvedValueOnce([{ count: 0 }]); // 2. fieldValues
    chain.where.mockResolvedValueOnce([{ count: 0 }]); // 3. groupMemberships
    chain.where.mockResolvedValueOnce([{ count: 0 }]); // 4. frontingSessions
    chain.where.mockResolvedValueOnce([{ count: 0 }]); // 5. relationships
    chain.where.mockResolvedValueOnce([{ count: 0 }]); // 6. notes
    chain.where.mockResolvedValueOnce([{ count: 0 }]); // 7. frontingComments
    chain.where.mockResolvedValueOnce([{ count: 0 }]); // 8. checkInRecords
    chain.where.mockResolvedValueOnce([{ count: 0 }]); // 9. polls
    chain.where.mockResolvedValueOnce([{ count: 4 }]); // 10. acknowledgements
    chain.where.mockResolvedValueOnce([{ count: 0 }]); // 11. systemStructureEntityMemberLinks

    try {
      await deleteMember(db, SYSTEM_ID, MEMBER_ID, AUTH, mockAudit);
      expect.unreachable("Should have thrown");
    } catch (err: unknown) {
      const error = err as {
        status: number;
        code: string;
        details: { dependents: { type: string; count: number }[] };
      };
      expect(error.status).toBe(409);
      expect(error.code).toBe("HAS_DEPENDENTS");
      expect(error.details.dependents).toEqual([{ type: "acknowledgements", count: 4 }]);
    }
  });
});
