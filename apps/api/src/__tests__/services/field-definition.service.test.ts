import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../helpers/mock-db.js";
import { mockOwnershipFailure } from "../helpers/mock-ownership.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { FieldDefinitionId, SystemId } from "@pluralscape/types";

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

const {
  createFieldDefinition,
  listFieldDefinitions,
  getFieldDefinition,
  updateFieldDefinition,
  archiveFieldDefinition,
  restoreFieldDefinition,
} = await import("../../services/field-definition.service.js");
const { assertSystemOwnership } = await import("../../lib/system-ownership.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const SYSTEM_ID = "sys_test-system" as SystemId;
const FIELD_ID = "fld_test-field" as FieldDefinitionId;

const AUTH: AuthContext = {
  accountId: "acct_test-account" as AuthContext["accountId"],
  systemId: SYSTEM_ID,
  sessionId: "sess_test-session" as AuthContext["sessionId"],
  accountType: "system",
};

const mockAudit = vi.fn().mockResolvedValue(undefined);
const VALID_BLOB_BASE64 = Buffer.from(new Uint8Array(40)).toString("base64");

function makeFieldDefRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "fld_test-field",
    systemId: SYSTEM_ID,
    fieldType: "text",
    required: false,
    sortOrder: 0,
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

describe("createFieldDefinition", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("creates a field definition successfully", async () => {
    const { db, chain } = mockDb();
    // count query: select().from().where() → resolves directly
    chain.where.mockResolvedValueOnce([{ count: 0 }]);
    // transaction → insert().values().returning() → row
    chain.returning.mockResolvedValueOnce([makeFieldDefRow()]);

    const result = await createFieldDefinition(
      db,
      SYSTEM_ID,
      { fieldType: "text", encryptedData: VALID_BLOB_BASE64 },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe("fld_test-field");
    expect(result.fieldType).toBe("text");
    expect(result.version).toBe(1);
    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "field-definition.created" }),
    );
  });

  it("throws validation error for invalid payload", async () => {
    const { db } = mockDb();

    await expect(
      createFieldDefinition(db, SYSTEM_ID, { fieldType: "invalid-type" }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("throws quota exceeded when at max field definitions", async () => {
    const { db, chain } = mockDb();
    // count query returns max
    chain.where.mockResolvedValueOnce([{ count: 200 }]);

    await expect(
      createFieldDefinition(
        db,
        SYSTEM_ID,
        { fieldType: "text", encryptedData: VALID_BLOB_BASE64 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 409, code: "QUOTA_EXCEEDED" }));
  });

  it("throws 400 for oversized blob (rejected by schema)", async () => {
    const { db } = mockDb();
    const oversized = Buffer.from(new Uint8Array(70_000)).toString("base64");

    await expect(
      createFieldDefinition(
        db,
        SYSTEM_ID,
        { fieldType: "text", encryptedData: oversized },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("rejects cross-system access", async () => {
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    const { db } = mockDb();
    await expect(
      createFieldDefinition(
        db,
        SYSTEM_ID,
        { fieldType: "text", encryptedData: VALID_BLOB_BASE64 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

describe("listFieldDefinitions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("returns empty page when no field definitions exist", async () => {
    const { db } = mockDb();

    const result = await listFieldDefinitions(db, SYSTEM_ID, AUTH);

    expect(result.items).toEqual([]);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
    expect(result.totalCount).toBeNull();
  });

  it("returns field definition items", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeFieldDefRow()]);

    const result = await listFieldDefinitions(db, SYSTEM_ID, AUTH);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe("fld_test-field");
    expect(result.hasMore).toBe(false);
  });

  it("caps limit to MAX_FIELD_LIMIT", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    await listFieldDefinitions(db, SYSTEM_ID, AUTH, { limit: 999 });

    // MAX_FIELD_LIMIT + 1 = 101
    expect(chain.limit).toHaveBeenCalledWith(101);
  });

  it("passes includeArchived filter", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeFieldDefRow({ archived: true, archivedAt: 2000 })]);

    const result = await listFieldDefinitions(db, SYSTEM_ID, AUTH, {
      includeArchived: true,
    });

    expect(result.items).toHaveLength(1);
    expect(chain.where).toHaveBeenCalled();
  });
});

describe("getFieldDefinition", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("returns field definition when found", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeFieldDefRow()]);

    const result = await getFieldDefinition(db, SYSTEM_ID, FIELD_ID, AUTH);

    expect(result.id).toBe("fld_test-field");
    expect(result.fieldType).toBe("text");
    expect(result.version).toBe(1);
  });

  it("throws 404 when not found", async () => {
    const { db } = mockDb();

    await expect(
      getFieldDefinition(db, SYSTEM_ID, "fld_nonexistent" as FieldDefinitionId, AUTH),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

describe("updateFieldDefinition", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("updates field definition successfully", async () => {
    const { db, chain } = mockDb();
    const updatedRow = makeFieldDefRow({ version: 2, encryptedData: new Uint8Array([1, 2, 3]) });
    chain.returning.mockResolvedValueOnce([updatedRow]);

    const result = await updateFieldDefinition(
      db,
      SYSTEM_ID,
      FIELD_ID,
      { encryptedData: VALID_BLOB_BASE64, version: 1 },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe("fld_test-field");
    expect(result.version).toBe(2);
    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "field-definition.updated" }),
    );
  });

  it("throws 409 on version conflict", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]);
    // Follow-up SELECT finds the field (= conflict, not 404)
    chain.limit.mockResolvedValueOnce([{ id: "fld_test-field" }]);

    await expect(
      updateFieldDefinition(
        db,
        SYSTEM_ID,
        FIELD_ID,
        { encryptedData: VALID_BLOB_BASE64, version: 1 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 409, code: "CONFLICT" }));
  });

  it("throws 404 when field definition not found", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]);
    chain.limit.mockResolvedValueOnce([]);

    await expect(
      updateFieldDefinition(
        db,
        SYSTEM_ID,
        FIELD_ID,
        { encryptedData: VALID_BLOB_BASE64, version: 1 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws validation error for invalid payload", async () => {
    const { db } = mockDb();

    await expect(
      updateFieldDefinition(db, SYSTEM_ID, FIELD_ID, { version: 1 }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("updates with optional required and sortOrder fields", async () => {
    const { db, chain } = mockDb();
    const updatedRow = makeFieldDefRow({
      version: 2,
      required: true,
      sortOrder: 5,
      encryptedData: new Uint8Array([1, 2, 3]),
    });
    chain.returning.mockResolvedValueOnce([updatedRow]);

    const result = await updateFieldDefinition(
      db,
      SYSTEM_ID,
      FIELD_ID,
      { encryptedData: VALID_BLOB_BASE64, version: 1, required: true, sortOrder: 5 },
      AUTH,
      mockAudit,
    );

    expect(result.required).toBe(true);
    expect(result.sortOrder).toBe(5);
    expect(result.version).toBe(2);
  });
});

describe("archiveFieldDefinition", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("archives a field definition successfully", async () => {
    const { db, chain } = mockDb();
    // transaction → select().from().where().limit() finds existing
    chain.limit.mockResolvedValueOnce([{ id: "fld_test-field" }]);

    await archiveFieldDefinition(db, SYSTEM_ID, FIELD_ID, AUTH, mockAudit);

    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "field-definition.archived" }),
    );
  });

  it("throws 404 when field definition not found", async () => {
    const { db } = mockDb();

    await expect(
      archiveFieldDefinition(
        db,
        SYSTEM_ID,
        "fld_nonexistent" as FieldDefinitionId,
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

describe("restoreFieldDefinition", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("restores an archived field definition successfully", async () => {
    const { db, chain } = mockDb();
    const archivedRow = makeFieldDefRow({ archived: true, archivedAt: 2000 });
    // transaction → select().from().where().limit() finds archived row
    chain.limit.mockResolvedValueOnce([archivedRow]);
    // transaction → update().set().where().returning() → restored row
    chain.returning.mockResolvedValueOnce([makeFieldDefRow({ archived: false, archivedAt: null })]);

    const result = await restoreFieldDefinition(db, SYSTEM_ID, FIELD_ID, AUTH, mockAudit);

    expect(result.id).toBe("fld_test-field");
    expect(result.archived).toBe(false);
    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "field-definition.restored" }),
    );
  });

  it("throws 404 when archived field definition not found", async () => {
    const { db } = mockDb();

    await expect(
      restoreFieldDefinition(
        db,
        SYSTEM_ID,
        "fld_nonexistent" as FieldDefinitionId,
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});
