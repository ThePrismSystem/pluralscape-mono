import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../helpers/mock-db.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { FieldDefinitionId, MemberId, SystemId } from "@pluralscape/types";

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

const { setFieldValue, listFieldValues, updateFieldValue, deleteFieldValue } =
  await import("../../services/field-value.service.js");
const { assertSystemOwnership } = await import("../../lib/system-ownership.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const SYSTEM_ID = "sys_test-system" as SystemId;
const MEMBER_ID = "mem_test-member" as MemberId;
const FIELD_DEF_ID = "fld_test-field" as FieldDefinitionId;

const AUTH: AuthContext = {
  accountId: "acct_test-account" as AuthContext["accountId"],
  systemId: SYSTEM_ID,
  sessionId: "sess_test-session" as AuthContext["sessionId"],
  accountType: "system",
};

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

describe("setFieldValue", () => {
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

    const result = await setFieldValue(
      db,
      SYSTEM_ID,
      MEMBER_ID,
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
      expect.anything(),
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
      setFieldValue(
        db,
        SYSTEM_ID,
        MEMBER_ID,
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
      setFieldValue(db, SYSTEM_ID, MEMBER_ID, FIELD_DEF_ID, {}, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("throws 404 when member not found", async () => {
    const { db, chain } = mockDb();
    // assertMemberActive → empty (not found)
    chain.limit.mockResolvedValueOnce([]);

    await expect(
      setFieldValue(
        db,
        SYSTEM_ID,
        MEMBER_ID,
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
      setFieldValue(
        db,
        SYSTEM_ID,
        MEMBER_ID,
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

  it("rejects cross-system access", async () => {
    const { ApiHttpError } = await import("../../lib/api-error.js");
    vi.mocked(assertSystemOwnership).mockRejectedValueOnce(
      new ApiHttpError(403, "FORBIDDEN", "System ownership check failed"),
    );
    const { db } = mockDb();
    await expect(
      setFieldValue(
        db,
        SYSTEM_ID,
        MEMBER_ID,
        FIELD_DEF_ID,
        { encryptedData: VALID_BLOB_BASE64 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 403, code: "FORBIDDEN" }));
  });
});

describe("listFieldValues", () => {
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

    const result = await listFieldValues(db, SYSTEM_ID, MEMBER_ID, AUTH);

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

    const result = await listFieldValues(db, SYSTEM_ID, MEMBER_ID, AUTH);

    expect(result).toEqual([]);
  });
});

describe("updateFieldValue", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("updates a field value successfully", async () => {
    const { db, chain } = mockDb();
    const updatedRow = makeFieldValueRow({ version: 2 });
    // assertMemberActive → member found
    chain.limit.mockResolvedValueOnce([{ id: MEMBER_ID }]);
    // assertFieldDefinitionActive → field def found
    chain.limit.mockResolvedValueOnce([{ id: FIELD_DEF_ID }]);
    // update().set().where().returning() → returns updated row
    chain.returning.mockResolvedValueOnce([updatedRow]);

    const result = await updateFieldValue(
      db,
      SYSTEM_ID,
      MEMBER_ID,
      FIELD_DEF_ID,
      { encryptedData: VALID_BLOB_BASE64, version: 1 },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe("fv_test-value");
    expect(result.version).toBe(2);
    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
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
      updateFieldValue(
        db,
        SYSTEM_ID,
        MEMBER_ID,
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
      updateFieldValue(
        db,
        SYSTEM_ID,
        MEMBER_ID,
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
      updateFieldValue(
        db,
        SYSTEM_ID,
        MEMBER_ID,
        FIELD_DEF_ID,
        { encryptedData: VALID_BLOB_BASE64 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });
});

describe("deleteFieldValue", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("deletes a field value successfully", async () => {
    const { db, chain } = mockDb();
    // assertMemberActive → member found
    chain.limit.mockResolvedValueOnce([{ id: MEMBER_ID }]);
    // delete().where().returning() → returns deleted row
    chain.returning.mockResolvedValueOnce([{ id: "fv_test-value" }]);

    await deleteFieldValue(db, SYSTEM_ID, MEMBER_ID, FIELD_DEF_ID, AUTH, mockAudit);

    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
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
      deleteFieldValue(db, SYSTEM_ID, MEMBER_ID, FIELD_DEF_ID, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});
