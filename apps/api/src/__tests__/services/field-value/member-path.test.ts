import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../../helpers/mock-db.js";
import { mockOwnershipFailure } from "../../helpers/mock-ownership.js";
import { AUTH, FIELD_DEF_ID, MEMBER_ID, SYSTEM_ID, VALID_BLOB_BASE64, makeFieldValueRow } from "./internal.js";

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
const { assertSystemOwnership } = await import("../../../lib/system-ownership.js");
const { InvalidInputError } = await import("@pluralscape/crypto");

// ── Fixtures ─────────────────────────────────────────────────────────

const mockAudit = vi.fn().mockResolvedValue(undefined);
const MEMBER_OWNER = { kind: "member" as const, id: MEMBER_ID };

// ── Tests ────────────────────────────────────────────────────────────

describe("setFieldValueForOwner (member path)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

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

    const result = await setFieldValueForOwner(db, SYSTEM_ID, MEMBER_OWNER, FIELD_DEF_ID, { encryptedData: VALID_BLOB_BASE64 }, AUTH, mockAudit);

    expect(result.id).toBe("fv_test-value");
    expect(result.fieldDefinitionId).toBe(FIELD_DEF_ID);
    expect(result.memberId).toBe(MEMBER_ID);
    expect(result.systemId).toBe(SYSTEM_ID);
    expect(result.version).toBe(1);
    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(chain, expect.objectContaining({ eventType: "field-value.set" }));
  });

  it("throws 409 when field value already exists", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: MEMBER_ID }]);
    chain.limit.mockResolvedValueOnce([{ id: FIELD_DEF_ID }]);
    chain.limit.mockResolvedValueOnce([{ id: "fv_existing" }]);

    await expect(
      setFieldValueForOwner(db, SYSTEM_ID, MEMBER_OWNER, FIELD_DEF_ID, { encryptedData: VALID_BLOB_BASE64 }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 409, code: "CONFLICT" }));
  });

  it("throws 404 when member not found", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    await expect(
      setFieldValueForOwner(db, SYSTEM_ID, MEMBER_OWNER, FIELD_DEF_ID, { encryptedData: VALID_BLOB_BASE64 }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND", message: "Member not found" }));
  });

  it("throws 404 when field definition not found", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: MEMBER_ID }]);
    chain.limit.mockResolvedValueOnce([]);

    await expect(
      setFieldValueForOwner(db, SYSTEM_ID, MEMBER_OWNER, FIELD_DEF_ID, { encryptedData: VALID_BLOB_BASE64 }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND", message: "Field definition not found" }));
  });

  it("throws 400 when encrypted blob fails deserialization", async () => {
    const { deserializeEncryptedBlob } = await import("@pluralscape/crypto");
    vi.mocked(deserializeEncryptedBlob).mockImplementationOnce(() => {
      throw new InvalidInputError("Invalid encrypted blob header");
    });

    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: MEMBER_ID }]);
    chain.limit.mockResolvedValueOnce([{ id: FIELD_DEF_ID }]);

    await expect(
      setFieldValueForOwner(db, SYSTEM_ID, MEMBER_OWNER, FIELD_DEF_ID, { encryptedData: VALID_BLOB_BASE64 }, AUTH, mockAudit),
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
      setFieldValueForOwner(db, SYSTEM_ID, MEMBER_OWNER, FIELD_DEF_ID, { encryptedData: VALID_BLOB_BASE64 }, AUTH, mockAudit),
    ).rejects.toThrow(TypeError);
  });

  it("rejects cross-system access", async () => {
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    const { db } = mockDb();

    await expect(
      setFieldValueForOwner(db, SYSTEM_ID, MEMBER_OWNER, FIELD_DEF_ID, { encryptedData: VALID_BLOB_BASE64 }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

describe("listFieldValuesForOwner (member path)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

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
    chain.limit.mockResolvedValueOnce([{ id: MEMBER_ID }]);
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

  it("updates a field value successfully", async () => {
    const { db, chain } = mockDb();
    const updatedRow = makeFieldValueRow({ version: 2 });
    chain.limit.mockResolvedValueOnce([{ id: MEMBER_ID }]);
    chain.limit.mockResolvedValueOnce([{ id: FIELD_DEF_ID }]);
    chain.returning.mockResolvedValueOnce([updatedRow]);

    const result = await updateFieldValueForOwner(
      db, SYSTEM_ID, MEMBER_OWNER, FIELD_DEF_ID,
      { encryptedData: VALID_BLOB_BASE64, version: 1 },
      AUTH, mockAudit,
    );

    expect(result.id).toBe("fv_test-value");
    expect(result.version).toBe(2);
    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(chain, expect.objectContaining({ eventType: "field-value.updated" }));
  });

  it("throws 409 on version conflict", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: MEMBER_ID }]);
    chain.limit.mockResolvedValueOnce([{ id: FIELD_DEF_ID }]);
    chain.returning.mockResolvedValueOnce([]);
    chain.limit.mockResolvedValueOnce([{ id: "fv_test-value" }]);

    await expect(
      updateFieldValueForOwner(db, SYSTEM_ID, MEMBER_OWNER, FIELD_DEF_ID, { encryptedData: VALID_BLOB_BASE64, version: 1 }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 409, code: "CONFLICT" }));
  });

  it("throws 404 when field value not found", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: MEMBER_ID }]);
    chain.limit.mockResolvedValueOnce([{ id: FIELD_DEF_ID }]);
    chain.returning.mockResolvedValueOnce([]);
    chain.limit.mockResolvedValueOnce([]);

    await expect(
      updateFieldValueForOwner(db, SYSTEM_ID, MEMBER_OWNER, FIELD_DEF_ID, { encryptedData: VALID_BLOB_BASE64, version: 1 }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

describe("deleteFieldValueForOwner (member path)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("deletes a field value successfully", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: MEMBER_ID }]);
    chain.returning.mockResolvedValueOnce([{ id: "fv_test-value" }]);

    await deleteFieldValueForOwner(db, SYSTEM_ID, MEMBER_OWNER, FIELD_DEF_ID, AUTH, mockAudit);

    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(chain, expect.objectContaining({ eventType: "field-value.deleted" }));
  });

  it("throws 404 when field value not found", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: MEMBER_ID }]);
    chain.returning.mockResolvedValueOnce([]);

    await expect(
      deleteFieldValueForOwner(db, SYSTEM_ID, MEMBER_OWNER, FIELD_DEF_ID, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});
