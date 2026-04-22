import { brandId } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../../helpers/mock-db.js";
import { mockOwnershipFailure } from "../../helpers/mock-ownership.js";
import { makeTestAuth } from "../../helpers/test-auth.js";

import type { SystemId, SystemStructureEntityLinkId } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock("../../../lib/system-ownership.js", () => ({
  assertSystemOwnership: vi.fn(),
}));

vi.mock("@pluralscape/db/pg", () => ({
  systemStructureEntityLinks: {
    id: "id",
    systemId: "system_id",
    entityId: "entity_id",
    parentEntityId: "parent_entity_id",
    sortOrder: "sort_order",
    createdAt: "created_at",
  },
}));

vi.mock("@pluralscape/types", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@pluralscape/types")>();
  return {
    ...actual,
    createId: vi.fn().mockReturnValue("sel_test-id"),
    now: vi.fn().mockReturnValue(1000),
  };
});

vi.mock("@pluralscape/validation", () => ({
  CreateStructureEntityLinkBodySchema: {
    safeParse: vi.fn().mockReturnValue({
      success: true,
      data: { entityId: "sse_child", parentEntityId: "sse_parent", sortOrder: 0 },
    }),
  },
  UpdateStructureEntityLinkBodySchema: {
    safeParse: vi.fn().mockReturnValue({
      success: true,
      data: { sortOrder: 5 },
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
    sql: Object.assign(vi.fn(), { join: vi.fn(), raw: vi.fn((s: string) => s) }),
  };
});

// ── Imports after mocks ──────────────────────────────────────────────

const { assertSystemOwnership } = await import("../../../lib/system-ownership.js");
const { CreateStructureEntityLinkBodySchema, UpdateStructureEntityLinkBodySchema } =
  await import("@pluralscape/validation");

const { createEntityLink, updateEntityLink, listEntityLinks, deleteEntityLink } =
  await import("../../../services/structure/link.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const SYSTEM_ID = brandId<SystemId>("sys_test-system");
const LINK_ID = brandId<SystemStructureEntityLinkId>("sel_test-link");
const AUTH = makeTestAuth({ systemId: SYSTEM_ID });
const mockAudit = vi.fn().mockResolvedValue(undefined);

function makeLinkRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: LINK_ID,
    systemId: SYSTEM_ID,
    entityId: "sse_child",
    parentEntityId: "sse_parent",
    sortOrder: 0,
    createdAt: 1000,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe("structure-entity-link service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  // ── createEntityLink ───────────────────────────────────────────

  describe("createEntityLink", () => {
    const validPayload = { entityId: "sse_child", parentEntityId: "sse_parent", sortOrder: 0 };

    it("creates a root link (null parent) without CTE queries", async () => {
      const { db, chain } = mockDb();
      const schema = vi.mocked(CreateStructureEntityLinkBodySchema);
      (schema.safeParse as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        success: true,
        data: { entityId: "sse_child", parentEntityId: null, sortOrder: 0 },
      });
      chain.returning.mockResolvedValueOnce([makeLinkRow({ parentEntityId: null })]);

      const result = await createEntityLink(db, SYSTEM_ID, validPayload, AUTH, mockAudit);

      expect(result.id).toBe(LINK_ID);
      expect(result.parentEntityId).toBeNull();
      expect(chain.insert).toHaveBeenCalled();
      expect(mockAudit).toHaveBeenCalledWith(
        chain,
        expect.objectContaining({ eventType: "structure-entity-link.created" }),
      );
      // setTenantContext calls execute once; no CTE queries for null parent
      expect(chain.execute).toHaveBeenCalledTimes(1);
    });

    it("creates a link with non-null parent when no cycle and depth ok", async () => {
      const { db, chain } = mockDb();
      // execute calls: setTenantContext, cycle CTE, depth CTE
      chain.execute
        .mockResolvedValueOnce(undefined) // setTenantContext
        .mockResolvedValueOnce([{ count: "0" }]) // cycle detection — no cycle
        .mockResolvedValueOnce([{ count: "3" }]); // depth check — well under 50
      chain.returning.mockResolvedValueOnce([makeLinkRow()]);

      const result = await createEntityLink(db, SYSTEM_ID, validPayload, AUTH, mockAudit);

      expect(result.id).toBe(LINK_ID);
      expect(result.entityId).toBe("sse_child");
      expect(result.parentEntityId).toBe("sse_parent");
      expect(result.sortOrder).toBe(0);
      expect(chain.execute).toHaveBeenCalledTimes(3);
      expect(mockAudit).toHaveBeenCalledWith(
        chain,
        expect.objectContaining({ eventType: "structure-entity-link.created" }),
      );
    });

    it("throws CYCLE_DETECTED when entityId === parentEntityId (self-link)", async () => {
      const { db } = mockDb();
      const schema = vi.mocked(CreateStructureEntityLinkBodySchema);
      (schema.safeParse as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        success: true,
        data: { entityId: "sse_same", parentEntityId: "sse_same", sortOrder: 0 },
      });

      await expect(createEntityLink(db, SYSTEM_ID, {}, AUTH, mockAudit)).rejects.toThrow(
        expect.objectContaining({ status: 409, code: "CYCLE_DETECTED" }),
      );
    });

    it("throws CYCLE_DETECTED when ancestor CTE finds a cycle", async () => {
      const { db, chain } = mockDb();
      // execute calls: setTenantContext, cycle CTE returns count > 0
      chain.execute
        .mockResolvedValueOnce(undefined) // setTenantContext
        .mockResolvedValueOnce([{ count: "1" }]); // cycle detected

      await expect(createEntityLink(db, SYSTEM_ID, validPayload, AUTH, mockAudit)).rejects.toThrow(
        expect.objectContaining({ status: 409, code: "CYCLE_DETECTED" }),
      );
    });

    it("throws MAX_DEPTH_EXCEEDED when depth >= 50", async () => {
      const { db, chain } = mockDb();
      // execute calls: setTenantContext, cycle CTE (ok), depth CTE (too deep)
      chain.execute
        .mockResolvedValueOnce(undefined) // setTenantContext
        .mockResolvedValueOnce([{ count: "0" }]) // no cycle
        .mockResolvedValueOnce([{ count: "50" }]); // depth at limit

      await expect(createEntityLink(db, SYSTEM_ID, validPayload, AUTH, mockAudit)).rejects.toThrow(
        expect.objectContaining({ status: 409, code: "MAX_DEPTH_EXCEEDED" }),
      );
    });

    it("throws MAX_DEPTH_EXCEEDED when depth exceeds 50", async () => {
      const { db, chain } = mockDb();
      chain.execute
        .mockResolvedValueOnce(undefined) // setTenantContext
        .mockResolvedValueOnce([{ count: "0" }]) // no cycle
        .mockResolvedValueOnce([{ count: "99" }]); // well over limit

      await expect(createEntityLink(db, SYSTEM_ID, validPayload, AUTH, mockAudit)).rejects.toThrow(
        expect.objectContaining({ status: 409, code: "MAX_DEPTH_EXCEEDED" }),
      );
    });

    it("creates a link when depth is exactly at boundary (49)", async () => {
      const { db, chain } = mockDb();
      chain.execute
        .mockResolvedValueOnce(undefined) // setTenantContext
        .mockResolvedValueOnce([{ count: "0" }]) // cycle detection — no cycle
        .mockResolvedValueOnce([{ count: "49" }]); // depth at boundary (under limit of 50)
      chain.returning.mockResolvedValueOnce([makeLinkRow()]);

      const result = await createEntityLink(db, SYSTEM_ID, validPayload, AUTH, mockAudit);

      expect(result.id).toBe(LINK_ID);
      expect(chain.insert).toHaveBeenCalled();
    });

    it("throws VALIDATION_ERROR for invalid payload", async () => {
      const { db } = mockDb();
      const schema = vi.mocked(CreateStructureEntityLinkBodySchema);
      (schema.safeParse as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        success: false,
        error: { issues: [] },
      });

      await expect(createEntityLink(db, SYSTEM_ID, {}, AUTH, mockAudit)).rejects.toThrow(
        expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }),
      );
    });

    it("throws when INSERT returns no rows", async () => {
      const { db, chain } = mockDb();
      chain.execute
        .mockResolvedValueOnce(undefined) // setTenantContext
        .mockResolvedValueOnce([{ count: "0" }]) // no cycle
        .mockResolvedValueOnce([{ count: "3" }]); // depth ok
      chain.returning.mockResolvedValueOnce([]);

      await expect(createEntityLink(db, SYSTEM_ID, validPayload, AUTH, mockAudit)).rejects.toThrow(
        "Failed to create entity link — INSERT returned no rows",
      );
    });

    it("throws 404 on ownership failure", async () => {
      const { db } = mockDb();
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));

      await expect(createEntityLink(db, SYSTEM_ID, validPayload, AUTH, mockAudit)).rejects.toThrow(
        expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
      );
    });
  });

  // ── updateEntityLink ───────────────────────────────────────────

  describe("updateEntityLink", () => {
    it("updates sortOrder and returns result", async () => {
      const { db, chain } = mockDb();
      // Existence check: select().from().where().limit(1).for("update")
      chain.where.mockReturnValueOnce(chain);
      chain.limit.mockReturnValueOnce(chain);
      chain.for.mockResolvedValueOnce([{ id: LINK_ID }]);
      // Update returning
      chain.returning.mockResolvedValueOnce([makeLinkRow({ sortOrder: 5 })]);

      const result = await updateEntityLink(
        db,
        SYSTEM_ID,
        LINK_ID,
        { sortOrder: 5 },
        AUTH,
        mockAudit,
      );

      expect(result.id).toBe(LINK_ID);
      expect(result.sortOrder).toBe(5);
      expect(chain.update).toHaveBeenCalled();
      expect(mockAudit).toHaveBeenCalledWith(
        chain,
        expect.objectContaining({ eventType: "structure-entity-link.updated" }),
      );
    });

    it("throws NOT_FOUND when link does not exist", async () => {
      const { db, chain } = mockDb();
      chain.where.mockReturnValueOnce(chain);
      chain.limit.mockReturnValueOnce(chain);
      chain.for.mockResolvedValueOnce([]);

      await expect(
        updateEntityLink(db, SYSTEM_ID, "sel_missing", { sortOrder: 1 }, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
    });

    it("throws VALIDATION_ERROR for invalid payload", async () => {
      const { db } = mockDb();
      const schema = vi.mocked(UpdateStructureEntityLinkBodySchema);
      (schema.safeParse as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        success: false,
        error: { issues: [] },
      });

      await expect(updateEntityLink(db, SYSTEM_ID, LINK_ID, {}, AUTH, mockAudit)).rejects.toThrow(
        expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }),
      );
    });

    it("throws when UPDATE returns no rows", async () => {
      const { db, chain } = mockDb();
      chain.where.mockReturnValueOnce(chain);
      chain.limit.mockReturnValueOnce(chain);
      chain.for.mockResolvedValueOnce([{ id: LINK_ID }]);
      chain.returning.mockResolvedValueOnce([]);

      await expect(
        updateEntityLink(db, SYSTEM_ID, LINK_ID, { sortOrder: 5 }, AUTH, mockAudit),
      ).rejects.toThrow("Failed to update entity link — UPDATE returned no rows");
    });

    it("throws 404 on ownership failure", async () => {
      const { db } = mockDb();
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));

      await expect(
        updateEntityLink(db, SYSTEM_ID, LINK_ID, { sortOrder: 1 }, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
    });
  });

  // ── listEntityLinks ────────────────────────────────────────────

  describe("listEntityLinks", () => {
    it("returns paginated results with defaults", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([makeLinkRow()]);

      const result = await listEntityLinks(db, SYSTEM_ID, AUTH);

      expect(result.data).toHaveLength(1);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });

    it("returns empty list when no rows", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([]);

      const result = await listEntityLinks(db, SYSTEM_ID, AUTH);

      expect(result.data).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });

    it("applies custom limit and detects hasMore", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([
        makeLinkRow({ id: "sel_1" }),
        makeLinkRow({ id: "sel_2" }),
      ]);

      const result = await listEntityLinks(db, SYSTEM_ID, AUTH, { limit: 1 });

      expect(result.data).toHaveLength(1);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).not.toBeNull();
    });

    it("applies cursor filter", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([makeLinkRow({ id: "sel_after" })]);

      const result = await listEntityLinks(db, SYSTEM_ID, AUTH, {
        cursor: "sel_before",
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.id).toBe("sel_after");
    });

    it("throws 404 on ownership failure", async () => {
      const { db } = mockDb();
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));

      await expect(listEntityLinks(db, SYSTEM_ID, AUTH)).rejects.toThrow(
        expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
      );
    });
  });

  // ── deleteEntityLink ───────────────────────────────────────────

  describe("deleteEntityLink", () => {
    it("deletes link when found", async () => {
      const { db, chain } = mockDb();
      chain.where.mockReturnValueOnce(chain);
      chain.limit.mockReturnValueOnce(chain);
      chain.for.mockResolvedValueOnce([{ id: LINK_ID }]);

      await expect(
        deleteEntityLink(db, SYSTEM_ID, LINK_ID, AUTH, mockAudit),
      ).resolves.toBeUndefined();
      expect(mockAudit).toHaveBeenCalledWith(
        chain,
        expect.objectContaining({ eventType: "structure-entity-link.deleted" }),
      );
    });

    it("throws NOT_FOUND when link does not exist", async () => {
      const { db, chain } = mockDb();
      chain.where.mockReturnValueOnce(chain);
      chain.limit.mockReturnValueOnce(chain);
      chain.for.mockResolvedValueOnce([]);

      await expect(deleteEntityLink(db, SYSTEM_ID, "sel_missing", AUTH, mockAudit)).rejects.toThrow(
        expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
      );
    });

    it("throws 404 on ownership failure", async () => {
      const { db } = mockDb();
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));

      await expect(deleteEntityLink(db, SYSTEM_ID, LINK_ID, AUTH, mockAudit)).rejects.toThrow(
        expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
      );
    });
  });
});
