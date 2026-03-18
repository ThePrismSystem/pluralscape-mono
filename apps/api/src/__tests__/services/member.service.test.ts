import { toCursor } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../helpers/mock-db.js";
import { mockOwnershipFailure } from "../helpers/mock-ownership.js";

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

const { InvalidInputError } = await import("@pluralscape/crypto");
const {
  createMember,
  listMembers,
  getMember,
  updateMember,
  duplicateMember,
  archiveMember,
  restoreMember,
} = await import("../../services/member.service.js");
const { assertSystemOwnership } = await import("../../lib/system-ownership.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const SYSTEM_ID = "sys_test-system" as SystemId;
const MEMBER_ID = "mem_test-member" as MemberId;

const AUTH: AuthContext = {
  accountId: "acct_test-account" as AuthContext["accountId"],
  systemId: SYSTEM_ID,
  sessionId: "sess_test-session" as AuthContext["sessionId"],
  accountType: "system",
};

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
      expect.anything(),
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
    expect(result.nextCursor).toBe("mem_a");
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

    await listMembers(db, SYSTEM_ID, AUTH, { cursor: toCursor("mem_cursor-id") });

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
      expect.anything(),
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
      expect.anything(),
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

  it("archives member and cascades to photos", async () => {
    const { db, chain } = mockDb();
    // 1. tx.select().from().where().limit() → find member
    chain.limit.mockResolvedValueOnce([{ id: "mem_test-member" }]);
    // 2. tx.update(memberPhotos).set().where() → cascade archive photos (where resolves chain)
    // 3. audit(tx, ...) → mockAudit handles this
    // 4. tx.update(members).set().where() → archive member (where resolves chain)

    await archiveMember(db, SYSTEM_ID, MEMBER_ID, AUTH, mockAudit);

    expect(chain.transaction).toHaveBeenCalled();
    expect(chain.update).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "member.archived" }),
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
      expect.anything(),
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
