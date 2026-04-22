import { brandId } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../../helpers/mock-db.js";
import { mockOwnershipFailure } from "../../helpers/mock-ownership.js";
import { makeTestAuth } from "../../helpers/test-auth.js";

import type { SystemId, SystemStructureEntityAssociationId } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock("../../../lib/system-ownership.js", () => ({
  assertSystemOwnership: vi.fn(),
}));

vi.mock("@pluralscape/db/pg", () => ({
  systemStructureEntityAssociations: {
    id: "id",
    systemId: "system_id",
    sourceEntityId: "source_entity_id",
    targetEntityId: "target_entity_id",
    createdAt: "created_at",
  },
  systemStructureEntityLinks: {
    entityId: "entity_id",
    parentEntityId: "parent_entity_id",
    systemId: "system_id",
  },
  systemStructureEntities: {
    id: "id",
    systemId: "system_id",
    archived: "archived",
  },
}));

vi.mock("@pluralscape/types", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@pluralscape/types")>();
  return {
    ...actual,
    createId: vi.fn().mockReturnValue("sea_test-id"),
    now: vi.fn().mockReturnValue(1000),
  };
});

vi.mock("@pluralscape/validation", () => ({
  CreateStructureEntityAssociationBodySchema: {
    safeParse: vi.fn().mockReturnValue({
      success: true,
      data: { sourceEntityId: "sse_source", targetEntityId: "sse_target" },
    }),
  },
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    and: vi.fn((...args: unknown[]) => args),
    eq: vi.fn((a: unknown, b: unknown) => [a, b]),
    gt: vi.fn((a: unknown, b: unknown) => ["gt", a, b]),
    count: vi.fn(() => "count(*)"),
    sql: Object.assign(vi.fn(), { join: vi.fn(), raw: vi.fn((s: string) => s) }),
  };
});

// ── Imports after mocks ──────────────────────────────────────────────

const { assertSystemOwnership } = await import("../../../lib/system-ownership.js");
const { CreateStructureEntityAssociationBodySchema } = await import("@pluralscape/validation");

const {
  createEntityAssociation,
  listEntityAssociations,
  deleteEntityAssociation,
  getEntityHierarchy,
} = await import("../../../services/structure/association.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const SYSTEM_ID = brandId<SystemId>("sys_test-system");
const ASSOC_ID = brandId<SystemStructureEntityAssociationId>("sea_test-assoc");
const AUTH = makeTestAuth({ systemId: SYSTEM_ID });
const mockAudit = vi.fn().mockResolvedValue(undefined);

function makeAssocRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: ASSOC_ID,
    systemId: SYSTEM_ID,
    sourceEntityId: "sse_source",
    targetEntityId: "sse_target",
    createdAt: 1000,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe("structure-entity-association service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  // ── createEntityAssociation ────────────────────────────────────

  describe("createEntityAssociation", () => {
    const validPayload = { sourceEntityId: "sse_source", targetEntityId: "sse_target" };

    it("creates an association and returns result", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([makeAssocRow()]);

      const result = await createEntityAssociation(db, SYSTEM_ID, validPayload, AUTH, mockAudit);

      expect(result.id).toBe(ASSOC_ID);
      expect(result.systemId).toBe(SYSTEM_ID);
      expect(result.sourceEntityId).toBe("sse_source");
      expect(result.targetEntityId).toBe("sse_target");
      expect(chain.insert).toHaveBeenCalled();
      expect(mockAudit).toHaveBeenCalledWith(
        chain,
        expect.objectContaining({ eventType: "structure-entity-association.created" }),
      );
    });

    it("throws VALIDATION_ERROR for invalid payload", async () => {
      const { db } = mockDb();
      const schema = vi.mocked(CreateStructureEntityAssociationBodySchema);
      (schema.safeParse as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        success: false,
        error: { issues: [] },
      });

      await expect(createEntityAssociation(db, SYSTEM_ID, {}, AUTH, mockAudit)).rejects.toThrow(
        expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }),
      );
    });

    it("throws when INSERT returns no rows", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([]);

      await expect(
        createEntityAssociation(db, SYSTEM_ID, validPayload, AUTH, mockAudit),
      ).rejects.toThrow("Failed to create entity association — INSERT returned no rows");
    });

    it("throws 404 on ownership failure", async () => {
      const { db } = mockDb();
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));

      await expect(
        createEntityAssociation(db, SYSTEM_ID, validPayload, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
    });
  });

  // ── listEntityAssociations ─────────────────────────────────────

  describe("listEntityAssociations", () => {
    it("returns paginated results with defaults", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([makeAssocRow()]);

      const result = await listEntityAssociations(db, SYSTEM_ID, AUTH);

      expect(result.data).toHaveLength(1);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });

    it("returns empty list when no rows", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([]);

      const result = await listEntityAssociations(db, SYSTEM_ID, AUTH);

      expect(result.data).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });

    it("applies custom limit and detects hasMore", async () => {
      const { db, chain } = mockDb();
      // Return limit+1 rows to trigger hasMore
      chain.limit.mockResolvedValueOnce([
        makeAssocRow({ id: "sea_1" }),
        makeAssocRow({ id: "sea_2" }),
      ]);

      const result = await listEntityAssociations(db, SYSTEM_ID, AUTH, { limit: 1 });

      expect(result.data).toHaveLength(1);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).not.toBeNull();
    });

    it("applies cursor filter", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([makeAssocRow({ id: "sea_after-cursor" })]);

      const result = await listEntityAssociations(db, SYSTEM_ID, AUTH, {
        cursor: "sea_before-cursor",
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.id).toBe("sea_after-cursor");
    });

    it("throws 404 on ownership failure", async () => {
      const { db } = mockDb();
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));

      await expect(listEntityAssociations(db, SYSTEM_ID, AUTH)).rejects.toThrow(
        expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
      );
    });
  });

  // ── deleteEntityAssociation ────────────────────────────────────

  describe("deleteEntityAssociation", () => {
    it("deletes association when found", async () => {
      const { db, chain } = mockDb();
      // Existence check: select().from().where().limit(1).for("update")
      chain.where.mockReturnValueOnce(chain);
      chain.limit.mockReturnValueOnce(chain);
      chain.for.mockResolvedValueOnce([{ id: ASSOC_ID }]);

      await expect(
        deleteEntityAssociation(db, SYSTEM_ID, ASSOC_ID, AUTH, mockAudit),
      ).resolves.toBeUndefined();
      expect(mockAudit).toHaveBeenCalledWith(
        chain,
        expect.objectContaining({ eventType: "structure-entity-association.deleted" }),
      );
    });

    it("throws NOT_FOUND when association does not exist", async () => {
      const { db, chain } = mockDb();
      // Existence check returns empty
      chain.where.mockReturnValueOnce(chain);
      chain.limit.mockReturnValueOnce(chain);
      chain.for.mockResolvedValueOnce([]);

      await expect(
        deleteEntityAssociation(db, SYSTEM_ID, "sea_missing", AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
    });

    it("throws 404 on ownership failure", async () => {
      const { db } = mockDb();
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));

      await expect(
        deleteEntityAssociation(db, SYSTEM_ID, ASSOC_ID, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
    });
  });

  // ── getEntityHierarchy ─────────────────────────────────────────

  describe("getEntityHierarchy", () => {
    it("returns hierarchy nodes when entity exists", async () => {
      const { db, chain } = mockDb();
      // Entity existence check: select().from().where().limit(1) resolves to entity
      chain.limit.mockResolvedValueOnce([{ id: "sse_entity" }]);
      // execute is called by setTenantContext, SET READ ONLY, then CTE query
      chain.execute
        .mockResolvedValueOnce(undefined) // setTenantContext
        .mockResolvedValueOnce(undefined) // SET TRANSACTION READ ONLY
        .mockResolvedValueOnce([
          { entity_id: "sse_entity", parent_entity_id: "sse_parent", depth: 1 },
          { entity_id: "sse_parent", parent_entity_id: null, depth: 2 },
        ]);

      const result = await getEntityHierarchy(db, SYSTEM_ID, "sse_entity", AUTH);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        entityId: "sse_entity",
        parentEntityId: "sse_parent",
        depth: 1,
      });
      expect(result[1]).toEqual({
        entityId: "sse_parent",
        parentEntityId: null,
        depth: 2,
      });
    });

    it("returns empty array when entity has no links", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([{ id: "sse_entity" }]);
      // execute is called by setTenantContext, SET READ ONLY, then CTE query
      chain.execute
        .mockResolvedValueOnce(undefined) // setTenantContext
        .mockResolvedValueOnce(undefined) // SET TRANSACTION READ ONLY
        .mockResolvedValueOnce([]);

      const result = await getEntityHierarchy(db, SYSTEM_ID, "sse_entity", AUTH);

      expect(result).toHaveLength(0);
    });

    it("throws NOT_FOUND when entity does not exist", async () => {
      const { db, chain } = mockDb();
      // Entity existence check returns empty
      chain.limit.mockResolvedValueOnce([]);

      await expect(getEntityHierarchy(db, SYSTEM_ID, "sse_missing", AUTH)).rejects.toThrow(
        expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
      );
    });

    it("throws 404 on ownership failure", async () => {
      const { db } = mockDb();
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));

      await expect(getEntityHierarchy(db, SYSTEM_ID, "sse_entity", AUTH)).rejects.toThrow(
        expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
      );
    });
  });
});
