import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../helpers/mock-db.js";
import { makeTestAuth } from "../helpers/test-auth.js";

import type { SystemId } from "@pluralscape/types";

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

vi.mock("../../lib/audit-log.js", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../lib/system-ownership.js", () => ({
  assertSystemOwnership: vi.fn(),
}));

// ── Import under test ────────────────────────────────────────────────

const {
  createEntityType,
  listEntityTypes,
  getEntityType,
  updateEntityType,
  archiveEntityType,
  restoreEntityType,
  deleteEntityType,
  createStructureEntity,
  listStructureEntities,
  getStructureEntity,
  updateStructureEntity,
  archiveStructureEntity,
  restoreStructureEntity,
  deleteStructureEntity,
  createEntityLink,
  listEntityLinks,
  deleteEntityLink,
  createEntityMemberLink,
  listEntityMemberLinks,
  deleteEntityMemberLink,
  createEntityAssociation,
  listEntityAssociations,
  deleteEntityAssociation,
  getEntityHierarchy,
} = await import("../../services/structure-entity.service.js");

// entity-lifecycle is used transitively by archive/restore — no direct imports needed

// ── Fixtures ─────────────────────────────────────────────────────────

const SYSTEM_ID = "sys_test-system" as SystemId;

const AUTH = makeTestAuth({
  accountId: "acct_test-account",
  systemId: SYSTEM_ID,
  sessionId: "sess_test-session",
});

const mockAudit = vi.fn().mockResolvedValue(undefined);

const VALID_BLOB_BASE64 = Buffer.from(new Uint8Array(40)).toString("base64");

function makeEntityTypeRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "set_test-entity-type",
    systemId: SYSTEM_ID,
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

function makeStructureEntityRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "sse_test-entity",
    systemId: SYSTEM_ID,
    entityTypeId: "set_test-entity-type",
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

function makeEntityMemberLinkRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "sem_test-member-link",
    systemId: SYSTEM_ID,
    parentEntityId: null,
    memberId: "mem_test-member",
    sortOrder: 0,
    createdAt: 1000,
    ...overrides,
  };
}

function makeEntityAssociationRow(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: "sea_test-assoc",
    systemId: SYSTEM_ID,
    sourceEntityId: "sse_test-entity-1",
    targetEntityId: "sse_test-entity-2",
    createdAt: 1000,
    ...overrides,
  };
}

// ════════════════════════════════════════════════════════════════════
// Entity Types
// ════════════════════════════════════════════════════════════════════

describe("createEntityType", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates an entity type with valid payload", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([makeEntityTypeRow()]);

    const result = await createEntityType(
      db,
      SYSTEM_ID,
      { encryptedData: VALID_BLOB_BASE64, sortOrder: 0 },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe("set_test-entity-type");
    expect(result.systemId).toBe(SYSTEM_ID);
    expect(result.sortOrder).toBe(0);
    expect(result.version).toBe(1);
    expect(chain.insert).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalled();
  });

  it("throws VALIDATION_ERROR for invalid payload", async () => {
    const { db } = mockDb();

    await expect(createEntityType(db, SYSTEM_ID, {}, AUTH, mockAudit)).rejects.toThrow(
      "Invalid create payload",
    );
  });

  it("throws when INSERT returns no rows", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]);

    await expect(
      createEntityType(
        db,
        SYSTEM_ID,
        { encryptedData: VALID_BLOB_BASE64, sortOrder: 0 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow("Failed to create entity type — INSERT returned no rows");
  });
});

describe("listEntityTypes", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns paginated results with defaults", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeEntityTypeRow()]);

    const result = await listEntityTypes(db, SYSTEM_ID, AUTH);

    expect(result.items).toHaveLength(1);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it("includes archived items when includeArchived is true", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      makeEntityTypeRow(),
      makeEntityTypeRow({ id: "set_archived", archived: true, archivedAt: 2000 }),
    ]);

    const result = await listEntityTypes(db, SYSTEM_ID, AUTH, { includeArchived: true });

    expect(result.items).toHaveLength(2);
  });

  it("applies cursor filter", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeEntityTypeRow({ id: "set_after-cursor" })]);

    const result = await listEntityTypes(db, SYSTEM_ID, AUTH, { cursor: "set_before-cursor" });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe("set_after-cursor");
  });

  it("applies custom limit and detects hasMore", async () => {
    const { db, chain } = mockDb();
    // Return limit+1 rows to trigger hasMore
    chain.limit.mockResolvedValueOnce([
      makeEntityTypeRow({ id: "set_1" }),
      makeEntityTypeRow({ id: "set_2" }),
    ]);

    const result = await listEntityTypes(db, SYSTEM_ID, AUTH, { limit: 1 });

    expect(result.items).toHaveLength(1);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).not.toBeNull();
  });

  it("returns empty list when no rows", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    const result = await listEntityTypes(db, SYSTEM_ID, AUTH);

    expect(result.items).toHaveLength(0);
    expect(result.hasMore).toBe(false);
  });
});

describe("getEntityType", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns entity type when found", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeEntityTypeRow()]);

    const result = await getEntityType(db, SYSTEM_ID, "set_test-entity-type", AUTH);

    expect(result.id).toBe("set_test-entity-type");
  });

  it("throws NOT_FOUND when entity type does not exist", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    await expect(getEntityType(db, SYSTEM_ID, "set_missing", AUTH)).rejects.toThrow(
      "Structure entity type not found",
    );
  });
});

describe("updateEntityType", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("updates entity type with valid payload", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([makeEntityTypeRow({ version: 2 })]);

    const result = await updateEntityType(
      db,
      SYSTEM_ID,
      "set_test-entity-type",
      { encryptedData: VALID_BLOB_BASE64, sortOrder: 1, version: 1 },
      AUTH,
      mockAudit,
    );

    expect(result.version).toBe(2);
    expect(mockAudit).toHaveBeenCalled();
  });

  it("throws VALIDATION_ERROR for invalid payload", async () => {
    const { db } = mockDb();

    await expect(
      updateEntityType(db, SYSTEM_ID, "set_test-entity-type", {}, AUTH, mockAudit),
    ).rejects.toThrow("Invalid update payload");
  });

  it("throws CONFLICT on version mismatch (entity exists)", async () => {
    const { db, chain } = mockDb();
    // OCC update returns empty (version mismatch)
    chain.returning.mockResolvedValueOnce([]);
    // assertOccUpdated existence check finds the entity
    chain.limit.mockResolvedValueOnce([{ id: "set_test-entity-type" }]);

    await expect(
      updateEntityType(
        db,
        SYSTEM_ID,
        "set_test-entity-type",
        { encryptedData: VALID_BLOB_BASE64, sortOrder: 1, version: 1 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow("Version conflict");
  });

  it("throws NOT_FOUND when entity does not exist", async () => {
    const { db, chain } = mockDb();
    // OCC update returns empty
    chain.returning.mockResolvedValueOnce([]);
    // assertOccUpdated existence check finds nothing
    chain.limit.mockResolvedValueOnce([]);

    await expect(
      updateEntityType(
        db,
        SYSTEM_ID,
        "set_missing",
        { encryptedData: VALID_BLOB_BASE64, sortOrder: 1, version: 1 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow("not found");
  });
});

describe("archiveEntityType", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("delegates to archiveEntity with correct lifecycle config", async () => {
    const { db, chain } = mockDb();
    // archiveEntity select -> limit returns row with archived: false
    chain.limit.mockResolvedValueOnce([makeEntityTypeRow({ archived: false })]);
    // archiveEntity update -> returning
    chain.returning.mockResolvedValueOnce([
      makeEntityTypeRow({ archived: true, archivedAt: 2000 }),
    ]);

    await expect(
      archiveEntityType(db, SYSTEM_ID, "set_test-entity-type", AUTH, mockAudit),
    ).resolves.toBeUndefined();
  });
});

describe("restoreEntityType", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("delegates to restoreEntity and returns mapped result", async () => {
    const { db, chain } = mockDb();
    // restoreEntity select -> limit returns archived row
    chain.limit.mockResolvedValueOnce([makeEntityTypeRow({ archived: true, archivedAt: 2000 })]);
    // restoreEntity update -> returning
    chain.returning.mockResolvedValueOnce([
      makeEntityTypeRow({ archived: false, archivedAt: null, version: 2 }),
    ]);

    const result = await restoreEntityType(db, SYSTEM_ID, "set_test-entity-type", AUTH, mockAudit);

    expect(result.id).toBe("set_test-entity-type");
    expect(result.archived).toBe(false);
  });
});

describe("deleteEntityType", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deletes entity type with no dependents", async () => {
    const { db, chain } = mockDb();
    // Existence check: select().from().where().limit(1).for("update")
    chain.where.mockReturnValueOnce(chain); // mid-chain, flows to limit
    chain.limit.mockReturnValueOnce(chain);
    chain.for.mockResolvedValueOnce([{ id: "set_test-entity-type" }]);
    // Entity count query: select().from().where() — terminal
    chain.where.mockResolvedValueOnce([{ count: 0 }]);

    await expect(
      deleteEntityType(db, SYSTEM_ID, "set_test-entity-type", AUTH, mockAudit),
    ).resolves.toBeUndefined();
    expect(mockAudit).toHaveBeenCalled();
  });

  it("throws NOT_FOUND when entity type does not exist", async () => {
    const { db, chain } = mockDb();
    // Existence check returns empty
    chain.where.mockReturnValueOnce(chain);
    chain.limit.mockReturnValueOnce(chain);
    chain.for.mockResolvedValueOnce([]);

    await expect(deleteEntityType(db, SYSTEM_ID, "set_missing", AUTH, mockAudit)).rejects.toThrow(
      "Structure entity type not found",
    );
  });

  it("throws HAS_DEPENDENTS when entity type has entities", async () => {
    const { db, chain } = mockDb();
    // Existence check
    chain.where.mockReturnValueOnce(chain);
    chain.limit.mockReturnValueOnce(chain);
    chain.for.mockResolvedValueOnce([{ id: "set_test-entity-type" }]);
    // Entity count query — terminal where
    chain.where.mockResolvedValueOnce([{ count: 3 }]);

    await expect(
      deleteEntityType(db, SYSTEM_ID, "set_test-entity-type", AUTH, mockAudit),
    ).rejects.toThrow("Structure entity type has 3 entity(s)");
  });
});

// ════════════════════════════════════════════════════════════════════
// Structure Entities
// ════════════════════════════════════════════════════════════════════

describe("createStructureEntity", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a structure entity with valid payload", async () => {
    const { db, chain } = mockDb();
    // Entity type existence check
    chain.limit.mockResolvedValueOnce([{ id: "set_test-entity-type" }]);
    // Insert returning
    chain.returning.mockResolvedValueOnce([makeStructureEntityRow()]);

    const result = await createStructureEntity(
      db,
      SYSTEM_ID,
      {
        structureEntityTypeId: "set_test-entity-type",
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
    // Entity type existence check
    chain.limit.mockResolvedValueOnce([{ id: "set_test-entity-type" }]);
    // Insert entity returning
    chain.returning
      .mockResolvedValueOnce([makeStructureEntityRow()])
      // Insert link returning (the second insert().values() chain)
      .mockResolvedValueOnce([makeEntityLinkRow()]);

    const result = await createStructureEntity(
      db,
      SYSTEM_ID,
      {
        structureEntityTypeId: "set_test-entity-type",
        encryptedData: VALID_BLOB_BASE64,
        parentEntityId: "sse_parent-entity",
        sortOrder: 0,
      },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe("sse_test-entity");
    // insert called twice: entity + link
    expect(chain.insert).toHaveBeenCalledTimes(2);
  });

  it("throws VALIDATION_ERROR for invalid payload", async () => {
    const { db } = mockDb();

    await expect(createStructureEntity(db, SYSTEM_ID, {}, AUTH, mockAudit)).rejects.toThrow(
      "Invalid create payload",
    );
  });

  it("throws NOT_FOUND when entity type does not exist", async () => {
    const { db, chain } = mockDb();
    // Entity type existence check returns empty
    chain.limit.mockResolvedValueOnce([]);

    await expect(
      createStructureEntity(
        db,
        SYSTEM_ID,
        {
          structureEntityTypeId: "set_missing",
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
    // Entity type existence check succeeds
    chain.limit.mockResolvedValueOnce([{ id: "set_test-entity-type" }]);
    // Insert returning empty
    chain.returning.mockResolvedValueOnce([]);

    await expect(
      createStructureEntity(
        db,
        SYSTEM_ID,
        {
          structureEntityTypeId: "set_test-entity-type",
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

    expect(result.items).toHaveLength(1);
    expect(result.hasMore).toBe(false);
  });

  it("filters by entityTypeId", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeStructureEntityRow()]);

    const result = await listStructureEntities(db, SYSTEM_ID, AUTH, {
      entityTypeId: "set_test-entity-type",
    });

    expect(result.items).toHaveLength(1);
    expect(chain.where).toHaveBeenCalled();
  });

  it("includes archived items when includeArchived is true", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      makeStructureEntityRow(),
      makeStructureEntityRow({ id: "sse_archived", archived: true }),
    ]);

    const result = await listStructureEntities(db, SYSTEM_ID, AUTH, { includeArchived: true });

    expect(result.items).toHaveLength(2);
  });

  it("applies cursor filter", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeStructureEntityRow({ id: "sse_after" })]);

    const result = await listStructureEntities(db, SYSTEM_ID, AUTH, { cursor: "sse_before" });

    expect(result.items).toHaveLength(1);
  });

  it("detects hasMore when rows exceed limit", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      makeStructureEntityRow({ id: "sse_1" }),
      makeStructureEntityRow({ id: "sse_2" }),
      makeStructureEntityRow({ id: "sse_3" }),
    ]);

    const result = await listStructureEntities(db, SYSTEM_ID, AUTH, { limit: 2 });

    expect(result.items).toHaveLength(2);
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

    const result = await getStructureEntity(db, SYSTEM_ID, "sse_test-entity", AUTH);

    expect(result.id).toBe("sse_test-entity");
    expect(result.entityTypeId).toBe("set_test-entity-type");
  });

  it("throws NOT_FOUND when entity does not exist", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    await expect(getStructureEntity(db, SYSTEM_ID, "sse_missing", AUTH)).rejects.toThrow(
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
      "sse_test-entity",
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

  it("throws VALIDATION_ERROR for invalid payload", async () => {
    const { db } = mockDb();

    await expect(
      updateStructureEntity(db, SYSTEM_ID, "sse_test-entity", {}, AUTH, mockAudit),
    ).rejects.toThrow("Invalid update payload");
  });

  it("throws CONFLICT on version mismatch", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]);
    // assertOccUpdated existence check finds entity
    chain.limit.mockResolvedValueOnce([{ id: "sse_test-entity" }]);

    await expect(
      updateStructureEntity(
        db,
        SYSTEM_ID,
        "sse_test-entity",
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
        "sse_missing",
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
      archiveStructureEntity(db, SYSTEM_ID, "sse_test-entity", AUTH, mockAudit),
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

    const result = await restoreStructureEntity(db, SYSTEM_ID, "sse_test-entity", AUTH, mockAudit);

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
    // Existence check: select().from().where().limit(1).for("update")
    chain.where.mockReturnValueOnce(chain); // mid-chain, flows to limit
    chain.limit.mockReturnValueOnce(chain);
    chain.for.mockResolvedValueOnce([{ id: "sse_test-entity" }]);
    // Three count queries in Promise.all — terminal where() calls
    chain.where
      .mockResolvedValueOnce([{ count: 0 }]) // entity links
      .mockResolvedValueOnce([{ count: 0 }]) // member links
      .mockResolvedValueOnce([{ count: 0 }]); // associations

    await expect(
      deleteStructureEntity(db, SYSTEM_ID, "sse_test-entity", AUTH, mockAudit),
    ).resolves.toBeUndefined();
    expect(mockAudit).toHaveBeenCalled();
  });

  it("throws NOT_FOUND when entity does not exist", async () => {
    const { db, chain } = mockDb();
    chain.where.mockReturnValueOnce(chain);
    chain.limit.mockReturnValueOnce(chain);
    chain.for.mockResolvedValueOnce([]);

    await expect(
      deleteStructureEntity(db, SYSTEM_ID, "sse_missing", AUTH, mockAudit),
    ).rejects.toThrow("Structure entity not found");
  });

  it("throws HAS_DEPENDENTS when entity has entity links", async () => {
    const { db, chain } = mockDb();
    chain.where.mockReturnValueOnce(chain);
    chain.limit.mockReturnValueOnce(chain);
    chain.for.mockResolvedValueOnce([{ id: "sse_test-entity" }]);
    chain.where
      .mockResolvedValueOnce([{ count: 2 }]) // entity links
      .mockResolvedValueOnce([{ count: 0 }]) // member links
      .mockResolvedValueOnce([{ count: 0 }]); // associations

    await expect(
      deleteStructureEntity(db, SYSTEM_ID, "sse_test-entity", AUTH, mockAudit),
    ).rejects.toThrow("Structure entity has dependents");
  });

  it("throws HAS_DEPENDENTS when entity has member links", async () => {
    const { db, chain } = mockDb();
    chain.where.mockReturnValueOnce(chain);
    chain.limit.mockReturnValueOnce(chain);
    chain.for.mockResolvedValueOnce([{ id: "sse_test-entity" }]);
    chain.where
      .mockResolvedValueOnce([{ count: 0 }]) // entity links
      .mockResolvedValueOnce([{ count: 1 }]) // member links
      .mockResolvedValueOnce([{ count: 0 }]); // associations

    await expect(
      deleteStructureEntity(db, SYSTEM_ID, "sse_test-entity", AUTH, mockAudit),
    ).rejects.toThrow("Structure entity has dependents");
  });

  it("throws HAS_DEPENDENTS when entity has associations", async () => {
    const { db, chain } = mockDb();
    chain.where.mockReturnValueOnce(chain);
    chain.limit.mockReturnValueOnce(chain);
    chain.for.mockResolvedValueOnce([{ id: "sse_test-entity" }]);
    chain.where
      .mockResolvedValueOnce([{ count: 0 }]) // entity links
      .mockResolvedValueOnce([{ count: 0 }]) // member links
      .mockResolvedValueOnce([{ count: 5 }]); // associations

    await expect(
      deleteStructureEntity(db, SYSTEM_ID, "sse_test-entity", AUTH, mockAudit),
    ).rejects.toThrow("Structure entity has dependents");
  });

  it("throws HAS_DEPENDENTS with multiple dependent types", async () => {
    const { db, chain } = mockDb();
    chain.where.mockReturnValueOnce(chain);
    chain.limit.mockReturnValueOnce(chain);
    chain.for.mockResolvedValueOnce([{ id: "sse_test-entity" }]);
    chain.where
      .mockResolvedValueOnce([{ count: 1 }]) // entity links
      .mockResolvedValueOnce([{ count: 2 }]) // member links
      .mockResolvedValueOnce([{ count: 3 }]); // associations

    await expect(
      deleteStructureEntity(db, SYSTEM_ID, "sse_test-entity", AUTH, mockAudit),
    ).rejects.toThrow("Structure entity has dependents");
  });
});

// ════════════════════════════════════════════════════════════════════
// Entity Links
// ════════════════════════════════════════════════════════════════════

describe("createEntityLink", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates an entity link with valid payload", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([makeEntityLinkRow()]);

    const result = await createEntityLink(
      db,
      SYSTEM_ID,
      { entityId: "sse_test-entity", parentEntityId: null, sortOrder: 0 },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe("sel_test-link");
    expect(result.entityId).toBe("sse_test-entity");
    expect(mockAudit).toHaveBeenCalled();
  });

  it("throws VALIDATION_ERROR for invalid payload", async () => {
    const { db } = mockDb();

    await expect(createEntityLink(db, SYSTEM_ID, {}, AUTH, mockAudit)).rejects.toThrow(
      "Invalid create payload",
    );
  });

  it("throws when INSERT returns no rows", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]);

    await expect(
      createEntityLink(
        db,
        SYSTEM_ID,
        { entityId: "sse_test-entity", parentEntityId: null, sortOrder: 0 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow("Failed to create entity link — INSERT returned no rows");
  });
});

describe("listEntityLinks", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns paginated results with defaults", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeEntityLinkRow()]);

    const result = await listEntityLinks(db, SYSTEM_ID, AUTH);

    expect(result.items).toHaveLength(1);
    expect(result.hasMore).toBe(false);
  });

  it("applies cursor filter", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeEntityLinkRow({ id: "sel_after" })]);

    const result = await listEntityLinks(db, SYSTEM_ID, AUTH, { cursor: "sel_before" });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe("sel_after");
  });

  it("detects hasMore when rows exceed limit", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      makeEntityLinkRow({ id: "sel_1" }),
      makeEntityLinkRow({ id: "sel_2" }),
    ]);

    const result = await listEntityLinks(db, SYSTEM_ID, AUTH, { limit: 1 });

    expect(result.items).toHaveLength(1);
    expect(result.hasMore).toBe(true);
  });
});

describe("deleteEntityLink", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deletes entity link when found", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockReturnValueOnce(chain);
    chain.for.mockResolvedValueOnce([{ id: "sel_test-link" }]);

    await expect(
      deleteEntityLink(db, SYSTEM_ID, "sel_test-link", AUTH, mockAudit),
    ).resolves.toBeUndefined();
    expect(mockAudit).toHaveBeenCalled();
  });

  it("throws NOT_FOUND when link does not exist", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockReturnValueOnce(chain);
    chain.for.mockResolvedValueOnce([]);

    await expect(deleteEntityLink(db, SYSTEM_ID, "sel_missing", AUTH, mockAudit)).rejects.toThrow(
      "Structure entity link not found",
    );
  });
});

// ════════════════════════════════════════════════════════════════════
// Entity Member Links
// ════════════════════════════════════════════════════════════════════

describe("createEntityMemberLink", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates an entity member link with valid payload", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([makeEntityMemberLinkRow()]);

    const result = await createEntityMemberLink(
      db,
      SYSTEM_ID,
      { parentEntityId: null, memberId: "mem_test-member", sortOrder: 0 },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe("sem_test-member-link");
    expect(result.memberId).toBe("mem_test-member");
    expect(mockAudit).toHaveBeenCalled();
  });

  it("throws VALIDATION_ERROR for invalid payload", async () => {
    const { db } = mockDb();

    await expect(createEntityMemberLink(db, SYSTEM_ID, {}, AUTH, mockAudit)).rejects.toThrow(
      "Invalid create payload",
    );
  });

  it("throws when INSERT returns no rows", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]);

    await expect(
      createEntityMemberLink(
        db,
        SYSTEM_ID,
        { parentEntityId: null, memberId: "mem_test-member", sortOrder: 0 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow("Failed to create entity member link — INSERT returned no rows");
  });
});

describe("listEntityMemberLinks", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns paginated results with defaults", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeEntityMemberLinkRow()]);

    const result = await listEntityMemberLinks(db, SYSTEM_ID, AUTH);

    expect(result.items).toHaveLength(1);
    expect(result.hasMore).toBe(false);
  });

  it("applies cursor filter", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeEntityMemberLinkRow({ id: "sem_after" })]);

    const result = await listEntityMemberLinks(db, SYSTEM_ID, AUTH, { cursor: "sem_before" });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe("sem_after");
  });

  it("detects hasMore when rows exceed limit", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      makeEntityMemberLinkRow({ id: "sem_1" }),
      makeEntityMemberLinkRow({ id: "sem_2" }),
    ]);

    const result = await listEntityMemberLinks(db, SYSTEM_ID, AUTH, { limit: 1 });

    expect(result.items).toHaveLength(1);
    expect(result.hasMore).toBe(true);
  });
});

describe("deleteEntityMemberLink", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deletes entity member link when found", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockReturnValueOnce(chain);
    chain.for.mockResolvedValueOnce([{ id: "sem_test-member-link" }]);

    await expect(
      deleteEntityMemberLink(db, SYSTEM_ID, "sem_test-member-link", AUTH, mockAudit),
    ).resolves.toBeUndefined();
    expect(mockAudit).toHaveBeenCalled();
  });

  it("throws NOT_FOUND when link does not exist", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockReturnValueOnce(chain);
    chain.for.mockResolvedValueOnce([]);

    await expect(
      deleteEntityMemberLink(db, SYSTEM_ID, "sem_missing", AUTH, mockAudit),
    ).rejects.toThrow("Structure entity member link not found");
  });
});

// ════════════════════════════════════════════════════════════════════
// Entity Associations
// ════════════════════════════════════════════════════════════════════

describe("createEntityAssociation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates an entity association with valid payload", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([makeEntityAssociationRow()]);

    const result = await createEntityAssociation(
      db,
      SYSTEM_ID,
      { sourceEntityId: "sse_test-entity-1", targetEntityId: "sse_test-entity-2" },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe("sea_test-assoc");
    expect(result.sourceEntityId).toBe("sse_test-entity-1");
    expect(result.targetEntityId).toBe("sse_test-entity-2");
    expect(mockAudit).toHaveBeenCalled();
  });

  it("throws VALIDATION_ERROR for invalid payload", async () => {
    const { db } = mockDb();

    await expect(createEntityAssociation(db, SYSTEM_ID, {}, AUTH, mockAudit)).rejects.toThrow(
      "Invalid create payload",
    );
  });

  it("throws when INSERT returns no rows", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]);

    await expect(
      createEntityAssociation(
        db,
        SYSTEM_ID,
        { sourceEntityId: "sse_test-entity-1", targetEntityId: "sse_test-entity-2" },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow("Failed to create entity association — INSERT returned no rows");
  });
});

describe("listEntityAssociations", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns paginated results with defaults", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeEntityAssociationRow()]);

    const result = await listEntityAssociations(db, SYSTEM_ID, AUTH);

    expect(result.items).toHaveLength(1);
    expect(result.hasMore).toBe(false);
  });

  it("applies cursor filter", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeEntityAssociationRow({ id: "sea_after" })]);

    const result = await listEntityAssociations(db, SYSTEM_ID, AUTH, { cursor: "sea_before" });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe("sea_after");
  });

  it("detects hasMore when rows exceed limit", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      makeEntityAssociationRow({ id: "sea_1" }),
      makeEntityAssociationRow({ id: "sea_2" }),
    ]);

    const result = await listEntityAssociations(db, SYSTEM_ID, AUTH, { limit: 1 });

    expect(result.items).toHaveLength(1);
    expect(result.hasMore).toBe(true);
  });
});

describe("deleteEntityAssociation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deletes entity association when found", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockReturnValueOnce(chain);
    chain.for.mockResolvedValueOnce([{ id: "sea_test-assoc" }]);

    await expect(
      deleteEntityAssociation(db, SYSTEM_ID, "sea_test-assoc", AUTH, mockAudit),
    ).resolves.toBeUndefined();
    expect(mockAudit).toHaveBeenCalled();
  });

  it("throws NOT_FOUND when association does not exist", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockReturnValueOnce(chain);
    chain.for.mockResolvedValueOnce([]);

    await expect(
      deleteEntityAssociation(db, SYSTEM_ID, "sea_missing", AUTH, mockAudit),
    ).rejects.toThrow("Structure entity association not found");
  });
});

// ════════════════════════════════════════════════════════════════════
// Hierarchy
// ════════════════════════════════════════════════════════════════════

describe("getEntityHierarchy", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns hierarchy nodes for existing entity", async () => {
    const { db, chain } = mockDb();
    // Entity existence check
    chain.limit.mockResolvedValueOnce([{ id: "sse_test-entity" }]);
    // withTenantRead calls: setTenantContext(tx.execute) + SET READ ONLY(tx.execute)
    // then the CTE uses tx.execute — skip the first 2 RLS calls with undefined
    chain.execute
      .mockResolvedValueOnce(undefined) // setTenantContext
      .mockResolvedValueOnce(undefined) // SET TRANSACTION READ ONLY
      .mockResolvedValueOnce([
        { entity_id: "sse_test-entity", parent_entity_id: "sse_parent", depth: 1 },
        { entity_id: "sse_parent", parent_entity_id: null, depth: 2 },
      ]);

    const result = await getEntityHierarchy(db, SYSTEM_ID, "sse_test-entity", AUTH);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      entityId: "sse_test-entity",
      parentEntityId: "sse_parent",
      depth: 1,
    });
    expect(result[1]).toEqual({
      entityId: "sse_parent",
      parentEntityId: null,
      depth: 2,
    });
  });

  it("throws NOT_FOUND when entity does not exist", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    await expect(getEntityHierarchy(db, SYSTEM_ID, "sse_missing", AUTH)).rejects.toThrow(
      "Structure entity not found",
    );
  });

  it("returns empty array when entity has no links", async () => {
    const { db, chain } = mockDb();
    // Entity existence check
    chain.limit.mockResolvedValueOnce([{ id: "sse_test-entity" }]);
    // Skip the 2 RLS execute calls, then the CTE returns empty
    chain.execute
      .mockResolvedValueOnce(undefined) // setTenantContext
      .mockResolvedValueOnce(undefined) // SET TRANSACTION READ ONLY
      .mockResolvedValueOnce([]);

    const result = await getEntityHierarchy(db, SYSTEM_ID, "sse_test-entity", AUTH);

    expect(result).toHaveLength(0);
  });
});
