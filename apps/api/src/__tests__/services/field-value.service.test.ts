import { brandId } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../helpers/mock-db.js";
import { mockOwnershipFailure } from "../helpers/mock-ownership.js";
import { makeTestAuth } from "../helpers/test-auth.js";

import type {
  FieldDefinitionId,
  GroupId,
  MemberId,
  SystemId,
  SystemStructureEntityId,
} from "@pluralscape/types";

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
  assertSystemOwnership: vi.fn(),
}));

// ── Import under test ────────────────────────────────────────────────

const {
  setFieldValueForOwner,
  listFieldValuesForOwner,
  updateFieldValueForOwner,
  deleteFieldValueForOwner,
} = await import("../../services/field-value.service.js");
const { assertSystemOwnership } = await import("../../lib/system-ownership.js");
const { InvalidInputError } = await import("@pluralscape/crypto");

// ── Fixtures ─────────────────────────────────────────────────────────

const SYSTEM_ID = brandId<SystemId>("sys_test-system");
const MEMBER_ID = brandId<MemberId>("mem_test-member");
const FIELD_DEF_ID = brandId<FieldDefinitionId>("fld_test-field");

const AUTH = makeTestAuth({
  accountId: "acct_test-account",
  systemId: SYSTEM_ID,
  sessionId: "sess_test-session",
});

const mockAudit = vi.fn().mockResolvedValue(undefined);
const VALID_BLOB_BASE64 = Buffer.from(new Uint8Array(40)).toString("base64");

function makeFieldValueRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "fv_test-value",
    fieldDefinitionId: FIELD_DEF_ID,
    memberId: MEMBER_ID,
    systemId: SYSTEM_ID,
    encryptedData: new Uint8Array([1, 2, 3]),
    version: 1,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe("setFieldValueForOwner (member path)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  const MEMBER_OWNER = { kind: "member" as const, id: MEMBER_ID };

  it("creates a field value successfully", async () => {
    const { db, chain } = mockDb();
    const row = makeFieldValueRow();
    // 1. assertMemberActive → limit returns member
    chain.limit.mockResolvedValueOnce([{ id: MEMBER_ID }]);
    // 2. assertFieldDefinitionActive → limit returns field def
    chain.limit.mockResolvedValueOnce([{ id: FIELD_DEF_ID }]);
    // 3. existing value check in transaction → limit returns empty (no conflict)
    chain.limit.mockResolvedValueOnce([]);
    // 4. insert returning
    chain.returning.mockResolvedValueOnce([row]);

    const result = await setFieldValueForOwner(
      db,
      SYSTEM_ID,
      MEMBER_OWNER,
      FIELD_DEF_ID,
      { encryptedData: VALID_BLOB_BASE64 },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe("fv_test-value");
    expect(result.fieldDefinitionId).toBe(FIELD_DEF_ID);
    expect(result.memberId).toBe(MEMBER_ID);
    expect(result.systemId).toBe(SYSTEM_ID);
    expect(result.version).toBe(1);
    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "field-value.set" }),
    );
  });

  it("throws 409 when field value already exists", async () => {
    const { db, chain } = mockDb();
    // 1. assertMemberActive → member found
    chain.limit.mockResolvedValueOnce([{ id: MEMBER_ID }]);
    // 2. assertFieldDefinitionActive → field def found
    chain.limit.mockResolvedValueOnce([{ id: FIELD_DEF_ID }]);
    // 3. existing value check → value found (conflict)
    chain.limit.mockResolvedValueOnce([{ id: "fv_existing" }]);

    await expect(
      setFieldValueForOwner(
        db,
        SYSTEM_ID,
        MEMBER_OWNER,
        FIELD_DEF_ID,
        { encryptedData: VALID_BLOB_BASE64 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 409, code: "CONFLICT" }));
  });

  it("throws 400 for invalid payload", async () => {
    const { db, chain } = mockDb();
    // assertMemberActive → member found
    chain.limit.mockResolvedValueOnce([{ id: MEMBER_ID }]);
    // assertFieldDefinitionActive → field def found
    chain.limit.mockResolvedValueOnce([{ id: FIELD_DEF_ID }]);

    await expect(
      setFieldValueForOwner(db, SYSTEM_ID, MEMBER_OWNER, FIELD_DEF_ID, {}, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("throws 404 when member not found", async () => {
    const { db, chain } = mockDb();
    // assertMemberActive → empty (not found)
    chain.limit.mockResolvedValueOnce([]);

    await expect(
      setFieldValueForOwner(
        db,
        SYSTEM_ID,
        MEMBER_OWNER,
        FIELD_DEF_ID,
        { encryptedData: VALID_BLOB_BASE64 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND", message: "Member not found" }),
    );
  });

  it("throws 404 when field definition not found", async () => {
    const { db, chain } = mockDb();
    // assertMemberActive → member found
    chain.limit.mockResolvedValueOnce([{ id: MEMBER_ID }]);
    // assertFieldDefinitionActive → empty (not found)
    chain.limit.mockResolvedValueOnce([]);

    await expect(
      setFieldValueForOwner(
        db,
        SYSTEM_ID,
        MEMBER_OWNER,
        FIELD_DEF_ID,
        { encryptedData: VALID_BLOB_BASE64 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(
      expect.objectContaining({
        status: 404,
        code: "NOT_FOUND",
        message: "Field definition not found",
      }),
    );
  });

  it("throws 400 when encrypted blob fails deserialization", async () => {
    const { deserializeEncryptedBlob } = await import("@pluralscape/crypto");
    const { InvalidInputError } = await import("@pluralscape/crypto");
    vi.mocked(deserializeEncryptedBlob).mockImplementationOnce(() => {
      throw new InvalidInputError("Invalid encrypted blob header");
    });

    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: MEMBER_ID }]);
    chain.limit.mockResolvedValueOnce([{ id: FIELD_DEF_ID }]);

    await expect(
      setFieldValueForOwner(
        db,
        SYSTEM_ID,
        MEMBER_OWNER,
        FIELD_DEF_ID,
        { encryptedData: VALID_BLOB_BASE64 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("rethrows non-InvalidInputError from deserialization", async () => {
    const { deserializeEncryptedBlob } = await import("@pluralscape/crypto");
    vi.mocked(deserializeEncryptedBlob).mockImplementationOnce(() => {
      throw new TypeError("Unexpected buffer layout");
    });

    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: MEMBER_ID }]);
    chain.limit.mockResolvedValueOnce([{ id: FIELD_DEF_ID }]);

    await expect(
      setFieldValueForOwner(
        db,
        SYSTEM_ID,
        MEMBER_OWNER,
        FIELD_DEF_ID,
        { encryptedData: VALID_BLOB_BASE64 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(TypeError);
  });

  it("rejects cross-system access", async () => {
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    const { db } = mockDb();
    await expect(
      setFieldValueForOwner(
        db,
        SYSTEM_ID,
        MEMBER_OWNER,
        FIELD_DEF_ID,
        { encryptedData: VALID_BLOB_BASE64 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

describe("listFieldValuesForOwner (member path)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  const MEMBER_OWNER = { kind: "member" as const, id: MEMBER_ID };

  it("returns field values for a member", async () => {
    const { db, chain } = mockDb();
    const rows = [makeFieldValueRow(), makeFieldValueRow({ id: "fv_second" })];
    // assertMemberActive → member found
    chain.limit.mockResolvedValueOnce([{ id: MEMBER_ID }]);
    // assertMemberActive's .where() chains to .limit(); list query's .where() is terminal
    chain.where.mockReturnValueOnce(chain).mockResolvedValueOnce(rows);

    const result = await listFieldValuesForOwner(db, SYSTEM_ID, MEMBER_OWNER, AUTH);

    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe("fv_test-value");
    expect(result[1]?.id).toBe("fv_second");
  });

  it("returns empty list when no field values exist", async () => {
    const { db, chain } = mockDb();
    // assertMemberActive → member found
    chain.limit.mockResolvedValueOnce([{ id: MEMBER_ID }]);
    // assertMemberActive's .where() chains to .limit(); list query's .where() is terminal
    chain.where.mockReturnValueOnce(chain).mockResolvedValueOnce([]);

    const result = await listFieldValuesForOwner(db, SYSTEM_ID, MEMBER_OWNER, AUTH);

    expect(result).toEqual([]);
  });
});

describe("updateFieldValueForOwner (member path)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  const MEMBER_OWNER = { kind: "member" as const, id: MEMBER_ID };

  it("updates a field value successfully", async () => {
    const { db, chain } = mockDb();
    const updatedRow = makeFieldValueRow({ version: 2 });
    // assertMemberActive → member found
    chain.limit.mockResolvedValueOnce([{ id: MEMBER_ID }]);
    // assertFieldDefinitionActive → field def found
    chain.limit.mockResolvedValueOnce([{ id: FIELD_DEF_ID }]);
    // update().set().where().returning() → returns updated row
    chain.returning.mockResolvedValueOnce([updatedRow]);

    const result = await updateFieldValueForOwner(
      db,
      SYSTEM_ID,
      MEMBER_OWNER,
      FIELD_DEF_ID,
      { encryptedData: VALID_BLOB_BASE64, version: 1 },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe("fv_test-value");
    expect(result.version).toBe(2);
    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "field-value.updated" }),
    );
  });

  it("throws 409 on version conflict", async () => {
    const { db, chain } = mockDb();
    // assertMemberActive → member found
    chain.limit.mockResolvedValueOnce([{ id: MEMBER_ID }]);
    // assertFieldDefinitionActive → field def found
    chain.limit.mockResolvedValueOnce([{ id: FIELD_DEF_ID }]);
    // update returning → empty (version mismatch)
    chain.returning.mockResolvedValueOnce([]);
    // follow-up SELECT finds existing → conflict
    chain.limit.mockResolvedValueOnce([{ id: "fv_test-value" }]);

    await expect(
      updateFieldValueForOwner(
        db,
        SYSTEM_ID,
        MEMBER_OWNER,
        FIELD_DEF_ID,
        { encryptedData: VALID_BLOB_BASE64, version: 1 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 409, code: "CONFLICT" }));
  });

  it("throws 404 when field value not found", async () => {
    const { db, chain } = mockDb();
    // assertMemberActive → member found
    chain.limit.mockResolvedValueOnce([{ id: MEMBER_ID }]);
    // assertFieldDefinitionActive → field def found
    chain.limit.mockResolvedValueOnce([{ id: FIELD_DEF_ID }]);
    // update returning → empty
    chain.returning.mockResolvedValueOnce([]);
    // follow-up SELECT finds nothing → not found
    chain.limit.mockResolvedValueOnce([]);

    await expect(
      updateFieldValueForOwner(
        db,
        SYSTEM_ID,
        MEMBER_OWNER,
        FIELD_DEF_ID,
        { encryptedData: VALID_BLOB_BASE64, version: 1 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 400 for invalid payload", async () => {
    const { db, chain } = mockDb();
    // assertMemberActive → member found
    chain.limit.mockResolvedValueOnce([{ id: MEMBER_ID }]);
    // assertFieldDefinitionActive → field def found
    chain.limit.mockResolvedValueOnce([{ id: FIELD_DEF_ID }]);

    await expect(
      updateFieldValueForOwner(
        db,
        SYSTEM_ID,
        MEMBER_OWNER,
        FIELD_DEF_ID,
        { encryptedData: VALID_BLOB_BASE64 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });
});

describe("deleteFieldValueForOwner (member path)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  const MEMBER_OWNER = { kind: "member" as const, id: MEMBER_ID };

  it("deletes a field value successfully", async () => {
    const { db, chain } = mockDb();
    // assertMemberActive → member found
    chain.limit.mockResolvedValueOnce([{ id: MEMBER_ID }]);
    // delete().where().returning() → returns deleted row
    chain.returning.mockResolvedValueOnce([{ id: "fv_test-value" }]);

    await deleteFieldValueForOwner(db, SYSTEM_ID, MEMBER_OWNER, FIELD_DEF_ID, AUTH, mockAudit);

    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "field-value.deleted" }),
    );
  });

  it("throws 404 when field value not found", async () => {
    const { db, chain } = mockDb();
    // assertMemberActive → member found
    chain.limit.mockResolvedValueOnce([{ id: MEMBER_ID }]);
    // delete().where().returning() → empty
    chain.returning.mockResolvedValueOnce([]);

    await expect(
      deleteFieldValueForOwner(db, SYSTEM_ID, MEMBER_OWNER, FIELD_DEF_ID, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

// ── Polymorphic owner paths (ForOwner variants) ─────────────────────

const GROUP_ID = brandId<GroupId>("grp_test-group");
const STRUCTURE_ENTITY_ID = brandId<SystemStructureEntityId>("sse_test-entity");

describe("setFieldValueForOwner", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("creates field value for group owner", async () => {
    const { db, chain } = mockDb();
    const row = makeFieldValueRow({ memberId: null, groupId: GROUP_ID, structureEntityId: null });
    // assertGroupActive → group found
    chain.limit.mockResolvedValueOnce([{ id: GROUP_ID }]);
    // assertFieldDefinitionActive → field def found
    chain.limit.mockResolvedValueOnce([{ id: FIELD_DEF_ID }]);
    // existing value check → no conflict
    chain.limit.mockResolvedValueOnce([]);
    // insert returning
    chain.returning.mockResolvedValueOnce([row]);

    const result = await setFieldValueForOwner(
      db,
      SYSTEM_ID,
      { kind: "group", id: GROUP_ID },
      FIELD_DEF_ID,
      { encryptedData: VALID_BLOB_BASE64 },
      AUTH,
      mockAudit,
    );

    expect(result.groupId).toBe(GROUP_ID);
    expect(result.memberId).toBeNull();
    expect(chain.transaction).toHaveBeenCalled();
  });

  it("creates field value for structureEntity owner", async () => {
    const { db, chain } = mockDb();
    const row = makeFieldValueRow({
      memberId: null,
      groupId: null,
      structureEntityId: STRUCTURE_ENTITY_ID,
    });
    // assertStructureEntityActive → entity found
    chain.limit.mockResolvedValueOnce([{ id: STRUCTURE_ENTITY_ID }]);
    // assertFieldDefinitionActive → field def found
    chain.limit.mockResolvedValueOnce([{ id: FIELD_DEF_ID }]);
    // existing value check → no conflict
    chain.limit.mockResolvedValueOnce([]);
    // insert returning
    chain.returning.mockResolvedValueOnce([row]);

    const result = await setFieldValueForOwner(
      db,
      SYSTEM_ID,
      { kind: "structureEntity", id: STRUCTURE_ENTITY_ID },
      FIELD_DEF_ID,
      { encryptedData: VALID_BLOB_BASE64 },
      AUTH,
      mockAudit,
    );

    expect(result.structureEntityId).toBe(STRUCTURE_ENTITY_ID);
    expect(result.memberId).toBeNull();
    expect(result.groupId).toBeNull();
  });

  it("throws 409 when field value already exists for group", async () => {
    const { db, chain } = mockDb();
    // assertGroupActive → group found
    chain.limit.mockResolvedValueOnce([{ id: GROUP_ID }]);
    // assertFieldDefinitionActive → field def found
    chain.limit.mockResolvedValueOnce([{ id: FIELD_DEF_ID }]);
    // existing value check → conflict
    chain.limit.mockResolvedValueOnce([{ id: "fv_existing" }]);

    await expect(
      setFieldValueForOwner(
        db,
        SYSTEM_ID,
        { kind: "group", id: GROUP_ID },
        FIELD_DEF_ID,
        { encryptedData: VALID_BLOB_BASE64 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 409, code: "CONFLICT" }));
  });

  it("throws VALIDATION_ERROR when payload is invalid for owner path", async () => {
    const { db } = mockDb();

    await expect(
      setFieldValueForOwner(
        db,
        SYSTEM_ID,
        { kind: "group", id: GROUP_ID },
        FIELD_DEF_ID,
        {},
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("wraps InvalidInputError from deserialization as VALIDATION_ERROR", async () => {
    const { deserializeEncryptedBlob } = await import("@pluralscape/crypto");
    vi.mocked(deserializeEncryptedBlob).mockImplementationOnce(() => {
      throw new InvalidInputError("Bad blob format");
    });

    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: MEMBER_ID }]);
    chain.limit.mockResolvedValueOnce([{ id: FIELD_DEF_ID }]);

    await expect(
      setFieldValueForOwner(
        db,
        SYSTEM_ID,
        { kind: "member", id: MEMBER_ID },
        FIELD_DEF_ID,
        { encryptedData: VALID_BLOB_BASE64 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("rethrows unknown errors from deserialization", async () => {
    const { deserializeEncryptedBlob } = await import("@pluralscape/crypto");
    vi.mocked(deserializeEncryptedBlob).mockImplementationOnce(() => {
      throw new RangeError("Out of bounds");
    });

    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: MEMBER_ID }]);
    chain.limit.mockResolvedValueOnce([{ id: FIELD_DEF_ID }]);

    await expect(
      setFieldValueForOwner(
        db,
        SYSTEM_ID,
        { kind: "member", id: MEMBER_ID },
        FIELD_DEF_ID,
        { encryptedData: VALID_BLOB_BASE64 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(RangeError);
  });
});

describe("listFieldValuesForOwner", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("lists field values for group owner", async () => {
    const { db, chain } = mockDb();
    const rows = [
      makeFieldValueRow({ memberId: null, groupId: GROUP_ID, structureEntityId: null }),
    ];
    // assertGroupActive → group found
    chain.limit.mockResolvedValueOnce([{ id: GROUP_ID }]);
    chain.where.mockReturnValueOnce(chain).mockResolvedValueOnce(rows);

    const result = await listFieldValuesForOwner(
      db,
      SYSTEM_ID,
      { kind: "group", id: GROUP_ID },
      AUTH,
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.groupId).toBe(GROUP_ID);
  });

  it("lists field values for structureEntity owner", async () => {
    const { db, chain } = mockDb();
    const rows = [
      makeFieldValueRow({
        memberId: null,
        groupId: null,
        structureEntityId: STRUCTURE_ENTITY_ID,
      }),
    ];
    // assertStructureEntityActive → entity found
    chain.limit.mockResolvedValueOnce([{ id: STRUCTURE_ENTITY_ID }]);
    chain.where.mockReturnValueOnce(chain).mockResolvedValueOnce(rows);

    const result = await listFieldValuesForOwner(
      db,
      SYSTEM_ID,
      { kind: "structureEntity", id: STRUCTURE_ENTITY_ID },
      AUTH,
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.structureEntityId).toBe(STRUCTURE_ENTITY_ID);
  });
});

describe("updateFieldValueForOwner", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("updates field value for group owner", async () => {
    const { db, chain } = mockDb();
    const updatedRow = makeFieldValueRow({
      memberId: null,
      groupId: GROUP_ID,
      structureEntityId: null,
      version: 2,
    });
    // assertGroupActive → group found
    chain.limit.mockResolvedValueOnce([{ id: GROUP_ID }]);
    // assertFieldDefinitionActive → field def found
    chain.limit.mockResolvedValueOnce([{ id: FIELD_DEF_ID }]);
    // update returning → success
    chain.returning.mockResolvedValueOnce([updatedRow]);

    const result = await updateFieldValueForOwner(
      db,
      SYSTEM_ID,
      { kind: "group", id: GROUP_ID },
      FIELD_DEF_ID,
      { encryptedData: VALID_BLOB_BASE64, version: 1 },
      AUTH,
      mockAudit,
    );

    expect(result.groupId).toBe(GROUP_ID);
    expect(result.version).toBe(2);
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "field-value.updated" }),
    );
  });

  it("updates field value for structureEntity owner", async () => {
    const { db, chain } = mockDb();
    const updatedRow = makeFieldValueRow({
      memberId: null,
      groupId: null,
      structureEntityId: STRUCTURE_ENTITY_ID,
      version: 2,
    });
    // assertStructureEntityActive → entity found
    chain.limit.mockResolvedValueOnce([{ id: STRUCTURE_ENTITY_ID }]);
    // assertFieldDefinitionActive → field def found
    chain.limit.mockResolvedValueOnce([{ id: FIELD_DEF_ID }]);
    // update returning → success
    chain.returning.mockResolvedValueOnce([updatedRow]);

    const result = await updateFieldValueForOwner(
      db,
      SYSTEM_ID,
      { kind: "structureEntity", id: STRUCTURE_ENTITY_ID },
      FIELD_DEF_ID,
      { encryptedData: VALID_BLOB_BASE64, version: 1 },
      AUTH,
      mockAudit,
    );

    expect(result.structureEntityId).toBe(STRUCTURE_ENTITY_ID);
    expect(result.version).toBe(2);
  });

  it("throws 409 on version conflict for group owner", async () => {
    const { db, chain } = mockDb();
    // assertGroupActive → group found
    chain.limit.mockResolvedValueOnce([{ id: GROUP_ID }]);
    // assertFieldDefinitionActive → field def found
    chain.limit.mockResolvedValueOnce([{ id: FIELD_DEF_ID }]);
    // update returning → empty (version mismatch)
    chain.returning.mockResolvedValueOnce([]);
    // follow-up SELECT finds existing → conflict
    chain.limit.mockResolvedValueOnce([{ id: "fv_test-value" }]);

    await expect(
      updateFieldValueForOwner(
        db,
        SYSTEM_ID,
        { kind: "group", id: GROUP_ID },
        FIELD_DEF_ID,
        { encryptedData: VALID_BLOB_BASE64, version: 1 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 409, code: "CONFLICT" }));
  });

  it("throws 404 when field value not found for structureEntity owner", async () => {
    const { db, chain } = mockDb();
    // assertStructureEntityActive → entity found
    chain.limit.mockResolvedValueOnce([{ id: STRUCTURE_ENTITY_ID }]);
    // assertFieldDefinitionActive → field def found
    chain.limit.mockResolvedValueOnce([{ id: FIELD_DEF_ID }]);
    // update returning → empty
    chain.returning.mockResolvedValueOnce([]);
    // follow-up SELECT finds nothing → not found
    chain.limit.mockResolvedValueOnce([]);

    await expect(
      updateFieldValueForOwner(
        db,
        SYSTEM_ID,
        { kind: "structureEntity", id: STRUCTURE_ENTITY_ID },
        FIELD_DEF_ID,
        { encryptedData: VALID_BLOB_BASE64, version: 1 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

describe("deleteFieldValueForOwner", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("deletes field value for group owner", async () => {
    const { db, chain } = mockDb();
    // assertGroupActive → group found
    chain.limit.mockResolvedValueOnce([{ id: GROUP_ID }]);
    // delete returning → success
    chain.returning.mockResolvedValueOnce([{ id: "fv_test-value" }]);

    await deleteFieldValueForOwner(
      db,
      SYSTEM_ID,
      { kind: "group", id: GROUP_ID },
      FIELD_DEF_ID,
      AUTH,
      mockAudit,
    );

    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "field-value.deleted" }),
    );
  });

  it("deletes field value for structureEntity owner", async () => {
    const { db, chain } = mockDb();
    // assertStructureEntityActive → entity found
    chain.limit.mockResolvedValueOnce([{ id: STRUCTURE_ENTITY_ID }]);
    // delete returning → success
    chain.returning.mockResolvedValueOnce([{ id: "fv_test-value" }]);

    await deleteFieldValueForOwner(
      db,
      SYSTEM_ID,
      { kind: "structureEntity", id: STRUCTURE_ENTITY_ID },
      FIELD_DEF_ID,
      AUTH,
      mockAudit,
    );

    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "field-value.deleted" }),
    );
  });

  it("throws 404 when field value not found for group owner", async () => {
    const { db, chain } = mockDb();
    // assertGroupActive → group found
    chain.limit.mockResolvedValueOnce([{ id: GROUP_ID }]);
    // delete returning → empty
    chain.returning.mockResolvedValueOnce([]);

    await expect(
      deleteFieldValueForOwner(
        db,
        SYSTEM_ID,
        { kind: "group", id: GROUP_ID },
        FIELD_DEF_ID,
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});
