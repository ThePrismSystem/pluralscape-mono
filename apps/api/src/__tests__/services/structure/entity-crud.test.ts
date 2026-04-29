import { brandId } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../../helpers/mock-db.js";
import { makeTestAuth } from "../../helpers/test-auth.js";

import type {
  SystemId,
  SystemStructureEntityId,
  SystemStructureEntityTypeId,
} from "@pluralscape/types";

// ── Mock external deps ───────────────────────────────────────────────

vi.mock("@pluralscape/crypto", () => ({
  serializeEncryptedBlob: vi.fn(() => new Uint8Array([1, 2, 3])),
  deserializeEncryptedBlob: vi.fn(() => ({
    tier: 1,
    algorithm: "xchacha20-poly1305",
    keyVersion: null,
    bucketId: null,
    nonce: new Uint8Array(24),
    ciphertext: new Uint8Array(8),
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

const { createStructureEntity } = await import("../../../services/structure/entity-crud/create.js");
const { listStructureEntities, getStructureEntity } =
  await import("../../../services/structure/entity-crud/queries.js");
const { updateStructureEntity } = await import("../../../services/structure/entity-crud/update.js");
const { archiveStructureEntity, restoreStructureEntity, deleteStructureEntity } =
  await import("../../../services/structure/entity-crud/lifecycle.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const SYSTEM_ID = brandId<SystemId>("sys_test-system");
const ENTITY_TYPE_ID = brandId<SystemStructureEntityTypeId>("set_test-entity-type");
const ENTITY_ID = brandId<SystemStructureEntityId>("sse_test-entity");
const MISSING_ENTITY_ID = brandId<SystemStructureEntityId>("sse_missing");

const AUTH = makeTestAuth({
  accountId: "acct_test-account",
  systemId: SYSTEM_ID,
  sessionId: "sess_test-session",
});

const mockAudit = vi.fn().mockResolvedValue(undefined);

const VALID_BLOB_BASE64 = Buffer.from(new Uint8Array(40)).toString("base64");

function makeStructureEntityRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "sse_test-entity",
    systemId: SYSTEM_ID,
    entityTypeId: ENTITY_TYPE_ID,
    sortOrder: 0,
    encryptedData: new Uint8Array([1, 2, 3]),
    version: 1,
    archived: false,
    archivedAt: null,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

function makeEntityLinkRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "sel_test-link",
    systemId: SYSTEM_ID,
    entityId: "sse_test-entity",
    parentEntityId: null,
    sortOrder: 0,
    createdAt: 1000,
    ...overrides,
  };
}

// ════════════════════════════════════════════════════════════════════
// Structure Entities
// ════════════════════════════════════════════════════════════════════

describe("createStructureEntity", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const PARENT_ENTITY_ID = brandId<SystemStructureEntityId>("sse_parent-entity");
  const MISSING_TYPE_ID = brandId<SystemStructureEntityTypeId>("set_missing");

  it("creates a structure entity with valid payload", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: "set_test-entity-type" }]);
    chain.returning.mockResolvedValueOnce([makeStructureEntityRow()]);

    const result = await createStructureEntity(
      db,
      SYSTEM_ID,
      {
        structureEntityTypeId: ENTITY_TYPE_ID,
        encryptedData: VALID_BLOB_BASE64,
        parentEntityId: null,
        sortOrder: 0,
      },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe("sse_test-entity");
    expect(result.entityTypeId).toBe("set_test-entity-type");
    expect(mockAudit).toHaveBeenCalled();
  });

  it("auto-creates entity link when parentEntityId is provided", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: "set_test-entity-type" }]);
    chain.returning
      .mockResolvedValueOnce([makeStructureEntityRow()])
      .mockResolvedValueOnce([makeEntityLinkRow()]);

    const result = await createStructureEntity(
      db,
      SYSTEM_ID,
      {
        structureEntityTypeId: ENTITY_TYPE_ID,
        encryptedData: VALID_BLOB_BASE64,
        parentEntityId: PARENT_ENTITY_ID,
        sortOrder: 0,
      },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe("sse_test-entity");
    expect(chain.insert).toHaveBeenCalledTimes(2);
  });

  it("throws NOT_FOUND when entity type does not exist", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    await expect(
      createStructureEntity(
        db,
        SYSTEM_ID,
        {
          structureEntityTypeId: MISSING_TYPE_ID,
          encryptedData: VALID_BLOB_BASE64,
          parentEntityId: null,
          sortOrder: 0,
        },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow("Structure entity type not found");
  });

  it("throws when INSERT returns no rows", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: "set_test-entity-type" }]);
    chain.returning.mockResolvedValueOnce([]);

    await expect(
      createStructureEntity(
        db,
        SYSTEM_ID,
        {
          structureEntityTypeId: ENTITY_TYPE_ID,
          encryptedData: VALID_BLOB_BASE64,
          parentEntityId: null,
          sortOrder: 0,
        },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow("Failed to create structure entity — INSERT returned no rows");
  });
});

describe("listStructureEntities", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns paginated results with defaults", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeStructureEntityRow()]);

    const result = await listStructureEntities(db, SYSTEM_ID, AUTH);

    expect(result.data).toHaveLength(1);
    expect(result.hasMore).toBe(false);
  });

  it("filters by entityTypeId", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeStructureEntityRow()]);

    const result = await listStructureEntities(db, SYSTEM_ID, AUTH, {
      entityTypeId: ENTITY_TYPE_ID,
    });

    expect(result.data).toHaveLength(1);
    expect(chain.where).toHaveBeenCalled();
  });

  it("includes archived items when includeArchived is true", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      makeStructureEntityRow(),
      makeStructureEntityRow({ id: "sse_archived", archived: true }),
    ]);

    const result = await listStructureEntities(db, SYSTEM_ID, AUTH, { includeArchived: true });

    expect(result.data).toHaveLength(2);
  });

  it("applies cursor filter", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeStructureEntityRow({ id: "sse_after" })]);

    const result = await listStructureEntities(db, SYSTEM_ID, AUTH, { cursor: "sse_before" });

    expect(result.data).toHaveLength(1);
  });

  it("detects hasMore when rows exceed limit", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      makeStructureEntityRow({ id: "sse_1" }),
      makeStructureEntityRow({ id: "sse_2" }),
      makeStructureEntityRow({ id: "sse_3" }),
    ]);

    const result = await listStructureEntities(db, SYSTEM_ID, AUTH, { limit: 2 });

    expect(result.data).toHaveLength(2);
    expect(result.hasMore).toBe(true);
  });
});

describe("getStructureEntity", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns entity when found", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeStructureEntityRow()]);

    const result = await getStructureEntity(db, SYSTEM_ID, ENTITY_ID, AUTH);

    expect(result.id).toBe("sse_test-entity");
    expect(result.entityTypeId).toBe("set_test-entity-type");
  });

  it("throws NOT_FOUND when entity does not exist", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    await expect(getStructureEntity(db, SYSTEM_ID, MISSING_ENTITY_ID, AUTH)).rejects.toThrow(
      "Structure entity not found",
    );
  });
});

describe("updateStructureEntity", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("updates entity with valid payload", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([makeStructureEntityRow({ version: 2 })]);

    const result = await updateStructureEntity(
      db,
      SYSTEM_ID,
      ENTITY_ID,
      {
        encryptedData: VALID_BLOB_BASE64,
        parentEntityId: null,
        sortOrder: 1,
        version: 1,
      },
      AUTH,
      mockAudit,
    );

    expect(result.version).toBe(2);
    expect(mockAudit).toHaveBeenCalled();
  });

  it("throws CONFLICT on version mismatch", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]);
    chain.limit.mockResolvedValueOnce([{ id: "sse_test-entity" }]);

    await expect(
      updateStructureEntity(
        db,
        SYSTEM_ID,
        ENTITY_ID,
        { encryptedData: VALID_BLOB_BASE64, parentEntityId: null, sortOrder: 1, version: 1 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow("Version conflict");
  });

  it("throws NOT_FOUND when entity does not exist", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]);
    chain.limit.mockResolvedValueOnce([]);

    await expect(
      updateStructureEntity(
        db,
        SYSTEM_ID,
        MISSING_ENTITY_ID,
        { encryptedData: VALID_BLOB_BASE64, parentEntityId: null, sortOrder: 1, version: 1 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow("not found");
  });
});

describe("archiveStructureEntity", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("delegates to archiveEntity", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeStructureEntityRow({ archived: false })]);
    chain.returning.mockResolvedValueOnce([
      makeStructureEntityRow({ archived: true, archivedAt: 2000 }),
    ]);

    await expect(
      archiveStructureEntity(db, SYSTEM_ID, ENTITY_ID, AUTH, mockAudit),
    ).resolves.toBeUndefined();
  });
});

describe("restoreStructureEntity", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("delegates to restoreEntity and returns mapped result", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      makeStructureEntityRow({ archived: true, archivedAt: 2000 }),
    ]);
    chain.returning.mockResolvedValueOnce([
      makeStructureEntityRow({ archived: false, archivedAt: null, version: 2 }),
    ]);

    const result = await restoreStructureEntity(db, SYSTEM_ID, ENTITY_ID, AUTH, mockAudit);

    expect(result.id).toBe("sse_test-entity");
    expect(result.archived).toBe(false);
  });
});

describe("deleteStructureEntity", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deletes entity with no dependents", async () => {
    const { db, chain } = mockDb();
    chain.where.mockReturnValueOnce(chain);
    chain.limit.mockReturnValueOnce(chain);
    chain.for.mockResolvedValueOnce([{ id: "sse_test-entity" }]);
    chain.where
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ count: 0 }]);

    await expect(
      deleteStructureEntity(db, SYSTEM_ID, ENTITY_ID, AUTH, mockAudit),
    ).resolves.toBeUndefined();
    expect(mockAudit).toHaveBeenCalled();
  });

  it("throws NOT_FOUND when entity does not exist", async () => {
    const { db, chain } = mockDb();
    chain.where.mockReturnValueOnce(chain);
    chain.limit.mockReturnValueOnce(chain);
    chain.for.mockResolvedValueOnce([]);

    await expect(
      deleteStructureEntity(db, SYSTEM_ID, MISSING_ENTITY_ID, AUTH, mockAudit),
    ).rejects.toThrow("Structure entity not found");
  });

  it("throws HAS_DEPENDENTS when entity has entity links", async () => {
    const { db, chain } = mockDb();
    chain.where.mockReturnValueOnce(chain);
    chain.limit.mockReturnValueOnce(chain);
    chain.for.mockResolvedValueOnce([{ id: "sse_test-entity" }]);
    chain.where
      .mockResolvedValueOnce([{ count: 2 }])
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ count: 0 }]);

    await expect(deleteStructureEntity(db, SYSTEM_ID, ENTITY_ID, AUTH, mockAudit)).rejects.toThrow(
      "Structure entity has dependents",
    );
  });

  it("throws HAS_DEPENDENTS when entity has member links", async () => {
    const { db, chain } = mockDb();
    chain.where.mockReturnValueOnce(chain);
    chain.limit.mockReturnValueOnce(chain);
    chain.for.mockResolvedValueOnce([{ id: "sse_test-entity" }]);
    chain.where
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ count: 1 }])
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ count: 0 }]);

    await expect(deleteStructureEntity(db, SYSTEM_ID, ENTITY_ID, AUTH, mockAudit)).rejects.toThrow(
      "Structure entity has dependents",
    );
  });

  it("throws HAS_DEPENDENTS when entity has associations", async () => {
    const { db, chain } = mockDb();
    chain.where.mockReturnValueOnce(chain);
    chain.limit.mockReturnValueOnce(chain);
    chain.for.mockResolvedValueOnce([{ id: "sse_test-entity" }]);
    chain.where
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ count: 5 }])
      .mockResolvedValueOnce([{ count: 0 }]);

    await expect(deleteStructureEntity(db, SYSTEM_ID, ENTITY_ID, AUTH, mockAudit)).rejects.toThrow(
      "Structure entity has dependents",
    );
  });

  it("throws HAS_DEPENDENTS when entity has notes", async () => {
    const { db, chain } = mockDb();
    chain.where.mockReturnValueOnce(chain);
    chain.limit.mockReturnValueOnce(chain);
    chain.for.mockResolvedValueOnce([{ id: "sse_test-entity" }]);
    chain.where
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ count: 3 }]);

    await expect(deleteStructureEntity(db, SYSTEM_ID, ENTITY_ID, AUTH, mockAudit)).rejects.toThrow(
      "Structure entity has dependents",
    );
  });

  it("throws HAS_DEPENDENTS with multiple dependent types", async () => {
    const { db, chain } = mockDb();
    chain.where.mockReturnValueOnce(chain);
    chain.limit.mockReturnValueOnce(chain);
    chain.for.mockResolvedValueOnce([{ id: "sse_test-entity" }]);
    chain.where
      .mockResolvedValueOnce([{ count: 1 }])
      .mockResolvedValueOnce([{ count: 2 }])
      .mockResolvedValueOnce([{ count: 3 }])
      .mockResolvedValueOnce([{ count: 0 }]);

    await expect(deleteStructureEntity(db, SYSTEM_ID, ENTITY_ID, AUTH, mockAudit)).rejects.toThrow(
      "Structure entity has dependents",
    );
  });
});
