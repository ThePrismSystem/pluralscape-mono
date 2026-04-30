import { brandId } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../../helpers/mock-db.js";

import {
  AUTH,
  FIELD_DEF_ID,
  MEMBER_ID,
  SYSTEM_ID,
  VALID_BLOB_BASE64,
  makeFieldValueRow,
} from "./internal.js";

import type { GroupId, SystemStructureEntityId } from "@pluralscape/types";

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

vi.mock("../../../lib/audit-log.js", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../lib/system-ownership.js", () => ({
  assertSystemOwnership: vi.fn(),
}));

// ── Import under test ────────────────────────────────────────────────

const { setFieldValueForOwner } = await import("../../../services/field-value/set.js");
const { listFieldValuesForOwner } = await import("../../../services/field-value/list.js");
const { updateFieldValueForOwner } = await import("../../../services/field-value/update.js");
const { deleteFieldValueForOwner } = await import("../../../services/field-value/delete.js");
const { InvalidInputError } = await import("@pluralscape/crypto");

// ── Fixtures ─────────────────────────────────────────────────────────

const GROUP_ID = brandId<GroupId>("grp_test-group");
const STRUCTURE_ENTITY_ID = brandId<SystemStructureEntityId>("sse_test-entity");

const mockAudit = vi.fn().mockResolvedValue(undefined);

// ── Tests ────────────────────────────────────────────────────────────

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
    const rows = [makeFieldValueRow({ memberId: null, groupId: GROUP_ID, structureEntityId: null })];
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
