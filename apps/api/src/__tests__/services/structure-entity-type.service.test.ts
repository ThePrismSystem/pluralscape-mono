import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../helpers/mock-db.js";
import { mockOwnershipFailure } from "../helpers/mock-ownership.js";
import { makeTestAuth } from "../helpers/test-auth.js";

import type { ArchivableEntityConfig } from "../../lib/entity-lifecycle.js";
import type { SystemId, SystemStructureEntityTypeId } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────────

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

vi.mock("../../lib/system-ownership.js", () => ({
  assertSystemOwnership: vi.fn(),
}));

vi.mock("../../lib/entity-lifecycle.js", () => ({
  archiveEntity: vi.fn().mockResolvedValue(undefined),
  restoreEntity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@pluralscape/db/pg", () => ({
  systemStructureEntityTypes: {
    id: "id",
    systemId: "system_id",
    sortOrder: "sort_order",
    encryptedData: "encrypted_data",
    version: "version",
    archived: "archived",
    archivedAt: "archived_at",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  systemStructureEntities: {
    id: "id",
    systemId: "system_id",
    entityTypeId: "entity_type_id",
  },
}));

vi.mock("@pluralscape/types", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@pluralscape/types")>();
  return {
    ...actual,
    createId: vi.fn().mockReturnValue("set_test-id"),
    now: vi.fn().mockReturnValue(1000),
  };
});

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    and: vi.fn((...args: unknown[]) => args),
    eq: vi.fn((a: unknown, b: unknown) => [a, b]),
    gt: vi.fn((a: unknown, b: unknown) => ["gt", a, b]),
    count: vi.fn(() => "count(*)"),
    sql: Object.assign(vi.fn(), { join: vi.fn() }),
  };
});

// ── Imports after mocks ──────────────────────────────────────────────

const { assertSystemOwnership } = await import("../../lib/system-ownership.js");
const { archiveEntity, restoreEntity } = await import("../../lib/entity-lifecycle.js");

const {
  createEntityType,
  listEntityTypes,
  getEntityType,
  updateEntityType,
  archiveEntityType,
  restoreEntityType,
  deleteEntityType,
} = await import("../../services/structure-entity-type.service.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const SYSTEM_ID = "sys_test-system" as SystemId;
const ENTITY_TYPE_ID = "set_test-entity-type" as SystemStructureEntityTypeId;
const AUTH = makeTestAuth({ systemId: SYSTEM_ID });
const mockAudit = vi.fn().mockResolvedValue(undefined);

const VALID_BLOB_BASE64 = Buffer.from(new Uint8Array(40)).toString("base64");

function makeEntityTypeRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: ENTITY_TYPE_ID,
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

// ── Tests ────────────────────────────────────────────────────────────

describe("structure-entity-type service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  // ── createEntityType ────────────────────────────────────────────

  describe("createEntityType", () => {
    const validPayload = { encryptedData: VALID_BLOB_BASE64, sortOrder: 0 };

    it("creates an entity type and returns result", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([makeEntityTypeRow()]);

      const result = await createEntityType(db, SYSTEM_ID, validPayload, AUTH, mockAudit);

      expect(result.id).toBe(ENTITY_TYPE_ID);
      expect(result.systemId).toBe(SYSTEM_ID);
      expect(result.sortOrder).toBe(0);
      expect(result.version).toBe(1);
      expect(chain.insert).toHaveBeenCalled();
      expect(mockAudit).toHaveBeenCalledWith(
        chain,
        expect.objectContaining({ eventType: "structure-entity-type.created" }),
      );
    });

    it("throws VALIDATION_ERROR for invalid payload", async () => {
      const { db } = mockDb();

      await expect(createEntityType(db, SYSTEM_ID, {}, AUTH, mockAudit)).rejects.toThrow(
        expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }),
      );
    });

    it("throws when INSERT returns no rows", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([]);

      await expect(createEntityType(db, SYSTEM_ID, validPayload, AUTH, mockAudit)).rejects.toThrow(
        "Failed to create entity type — INSERT returned no rows",
      );
    });

    it("throws 404 on ownership failure", async () => {
      const { db } = mockDb();
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));

      await expect(createEntityType(db, SYSTEM_ID, validPayload, AUTH, mockAudit)).rejects.toThrow(
        expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
      );
    });
  });

  // ── listEntityTypes ─────────────────────────────────────────────

  describe("listEntityTypes", () => {
    it("returns paginated results with defaults", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([makeEntityTypeRow()]);

      const result = await listEntityTypes(db, SYSTEM_ID, AUTH);

      expect(result.data).toHaveLength(1);
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

      expect(result.data).toHaveLength(2);
    });

    it("applies cursor filter", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([makeEntityTypeRow({ id: "set_after-cursor" })]);

      const result = await listEntityTypes(db, SYSTEM_ID, AUTH, { cursor: "set_before-cursor" });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.id).toBe("set_after-cursor");
    });

    it("applies custom limit and detects hasMore", async () => {
      const { db, chain } = mockDb();
      // Return limit+1 rows to trigger hasMore
      chain.limit.mockResolvedValueOnce([
        makeEntityTypeRow({ id: "set_1" }),
        makeEntityTypeRow({ id: "set_2" }),
      ]);

      const result = await listEntityTypes(db, SYSTEM_ID, AUTH, { limit: 1 });

      expect(result.data).toHaveLength(1);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).not.toBeNull();
    });

    it("returns empty list when no rows", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([]);

      const result = await listEntityTypes(db, SYSTEM_ID, AUTH);

      expect(result.data).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });

    it("throws 404 on ownership failure", async () => {
      const { db } = mockDb();
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));

      await expect(listEntityTypes(db, SYSTEM_ID, AUTH)).rejects.toThrow(
        expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
      );
    });
  });

  // ── getEntityType ───────────────────────────────────────────────

  describe("getEntityType", () => {
    it("returns entity type when found", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([makeEntityTypeRow()]);

      const result = await getEntityType(db, SYSTEM_ID, ENTITY_TYPE_ID, AUTH);

      expect(result.id).toBe(ENTITY_TYPE_ID);
      expect(result.systemId).toBe(SYSTEM_ID);
    });

    it("throws NOT_FOUND when entity type does not exist", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([]);

      await expect(
        getEntityType(db, SYSTEM_ID, "set_missing" as SystemStructureEntityTypeId, AUTH),
      ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
    });

    it("throws 404 on ownership failure", async () => {
      const { db } = mockDb();
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));

      await expect(getEntityType(db, SYSTEM_ID, ENTITY_TYPE_ID, AUTH)).rejects.toThrow(
        expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
      );
    });
  });

  // ── updateEntityType ────────────────────────────────────────────

  describe("updateEntityType", () => {
    const validUpdate = { encryptedData: VALID_BLOB_BASE64, sortOrder: 1, version: 1 };

    it("updates entity type with valid payload", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([makeEntityTypeRow({ version: 2 })]);

      const result = await updateEntityType(
        db,
        SYSTEM_ID,
        ENTITY_TYPE_ID,
        validUpdate,
        AUTH,
        mockAudit,
      );

      expect(result.version).toBe(2);
      expect(mockAudit).toHaveBeenCalledWith(
        chain,
        expect.objectContaining({ eventType: "structure-entity-type.updated" }),
      );
    });

    it("throws VALIDATION_ERROR for invalid payload", async () => {
      const { db } = mockDb();

      await expect(
        updateEntityType(db, SYSTEM_ID, ENTITY_TYPE_ID, {}, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
    });

    it("throws CONFLICT on version mismatch (entity exists)", async () => {
      const { db, chain } = mockDb();
      // OCC update returns empty (version mismatch)
      chain.returning.mockResolvedValueOnce([]);
      // assertOccUpdated existence check finds the entity
      chain.limit.mockResolvedValueOnce([{ id: ENTITY_TYPE_ID }]);

      await expect(
        updateEntityType(db, SYSTEM_ID, ENTITY_TYPE_ID, validUpdate, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 409, code: "CONFLICT" }));
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
          "set_missing" as SystemStructureEntityTypeId,
          validUpdate,
          AUTH,
          mockAudit,
        ),
      ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
    });

    it("throws 404 on ownership failure", async () => {
      const { db } = mockDb();
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));

      await expect(
        updateEntityType(db, SYSTEM_ID, ENTITY_TYPE_ID, validUpdate, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
    });
  });

  // ── archiveEntityType ───────────────────────────────────────────

  describe("archiveEntityType", () => {
    it("delegates to archiveEntity with correct lifecycle config", async () => {
      const { db } = mockDb();
      vi.mocked(archiveEntity).mockResolvedValueOnce(undefined);

      await archiveEntityType(db, SYSTEM_ID, ENTITY_TYPE_ID, AUTH, mockAudit);

      expect(archiveEntity).toHaveBeenCalledWith(
        db,
        SYSTEM_ID,
        ENTITY_TYPE_ID,
        AUTH,
        mockAudit,
        expect.objectContaining<Partial<ArchivableEntityConfig<string>>>({
          entityName: "Structure entity type",
          archiveEvent: "structure-entity-type.archived",
          restoreEvent: "structure-entity-type.restored",
        }),
      );
    });
  });

  // ── restoreEntityType ───────────────────────────────────────────

  describe("restoreEntityType", () => {
    it("delegates to restoreEntity and maps the row", async () => {
      const { db } = mockDb();
      const row = makeEntityTypeRow({ version: 3, archived: false, archivedAt: null });

      vi.mocked(restoreEntity).mockImplementationOnce(
        async (_db, _sId, _eid, _auth, _audit, _cfg, toResult) => Promise.resolve(toResult(row)),
      );

      const result = await restoreEntityType(db, SYSTEM_ID, ENTITY_TYPE_ID, AUTH, mockAudit);

      expect(result.id).toBe(ENTITY_TYPE_ID);
      expect(result.version).toBe(3);
      expect(result.archived).toBe(false);
    });

    it("passes correct lifecycle config to restoreEntity", async () => {
      const { db } = mockDb();
      vi.mocked(restoreEntity).mockImplementationOnce(
        async (_db, _sId, _eid, _auth, _audit, _cfg, toResult) =>
          Promise.resolve(toResult(makeEntityTypeRow())),
      );

      await restoreEntityType(db, SYSTEM_ID, ENTITY_TYPE_ID, AUTH, mockAudit);

      expect(restoreEntity).toHaveBeenCalledWith(
        db,
        SYSTEM_ID,
        ENTITY_TYPE_ID,
        AUTH,
        mockAudit,
        expect.objectContaining<Partial<ArchivableEntityConfig<string>>>({
          entityName: "Structure entity type",
          archiveEvent: "structure-entity-type.archived",
          restoreEvent: "structure-entity-type.restored",
        }),
        expect.any(Function),
      );
    });
  });

  // ── deleteEntityType ────────────────────────────────────────────

  describe("deleteEntityType", () => {
    it("deletes entity type with no dependents", async () => {
      const { db, chain } = mockDb();
      // Existence check: select().from().where().limit(1).for("update")
      chain.where.mockReturnValueOnce(chain);
      chain.limit.mockReturnValueOnce(chain);
      chain.for.mockResolvedValueOnce([{ id: ENTITY_TYPE_ID }]);
      // Entity count query: select().from().where() — terminal
      chain.where.mockResolvedValueOnce([{ count: 0 }]);

      await expect(
        deleteEntityType(db, SYSTEM_ID, ENTITY_TYPE_ID, AUTH, mockAudit),
      ).resolves.toBeUndefined();
      expect(mockAudit).toHaveBeenCalledWith(
        chain,
        expect.objectContaining({ eventType: "structure-entity-type.deleted" }),
      );
    });

    it("throws NOT_FOUND when entity type does not exist", async () => {
      const { db, chain } = mockDb();
      // Existence check returns empty
      chain.where.mockReturnValueOnce(chain);
      chain.limit.mockReturnValueOnce(chain);
      chain.for.mockResolvedValueOnce([]);

      await expect(
        deleteEntityType(
          db,
          SYSTEM_ID,
          "set_missing" as SystemStructureEntityTypeId,
          AUTH,
          mockAudit,
        ),
      ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
    });

    it("throws HAS_DEPENDENTS when entity type has entities", async () => {
      const { db, chain } = mockDb();
      // Existence check
      chain.where.mockReturnValueOnce(chain);
      chain.limit.mockReturnValueOnce(chain);
      chain.for.mockResolvedValueOnce([{ id: ENTITY_TYPE_ID }]);
      // Entity count query — terminal where
      chain.where.mockResolvedValueOnce([{ count: 3 }]);

      await expect(
        deleteEntityType(db, SYSTEM_ID, ENTITY_TYPE_ID, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 409, code: "HAS_DEPENDENTS" }));
    });

    it("includes dependent count in HAS_DEPENDENTS error message", async () => {
      const { db, chain } = mockDb();
      chain.where.mockReturnValueOnce(chain);
      chain.limit.mockReturnValueOnce(chain);
      chain.for.mockResolvedValueOnce([{ id: ENTITY_TYPE_ID }]);
      chain.where.mockResolvedValueOnce([{ count: 5 }]);

      await expect(
        deleteEntityType(db, SYSTEM_ID, ENTITY_TYPE_ID, AUTH, mockAudit),
      ).rejects.toThrow("Structure entity type has 5 entity(s)");
    });

    it("throws when count query returned no rows", async () => {
      const { db, chain } = mockDb();
      // Existence check succeeds
      chain.where.mockReturnValueOnce(chain);
      chain.limit.mockReturnValueOnce(chain);
      chain.for.mockResolvedValueOnce([{ id: ENTITY_TYPE_ID }]);
      // Count query returns empty array
      chain.where.mockResolvedValueOnce([]);

      await expect(
        deleteEntityType(db, SYSTEM_ID, ENTITY_TYPE_ID, AUTH, mockAudit),
      ).rejects.toThrow("Unexpected: count query returned no rows");
    });

    it("throws 404 on ownership failure", async () => {
      const { db } = mockDb();
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));

      await expect(
        deleteEntityType(db, SYSTEM_ID, ENTITY_TYPE_ID, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
    });
  });
});
