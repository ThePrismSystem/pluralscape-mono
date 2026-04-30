import { brandId } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../../helpers/mock-db.js";
import { mockOwnershipFailure } from "../../helpers/mock-ownership.js";
import { makeTestAuth } from "../../helpers/test-auth.js";

import type {
  SystemId,
  SystemStructureEntityId,
  SystemStructureEntityLinkId,
} from "@pluralscape/types";

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

const { createEntityLink, updateEntityLink, listEntityLinks, deleteEntityLink } =
  await import("../../../services/structure/link.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const SYSTEM_ID = brandId<SystemId>("sys_test-system");
const LINK_ID = brandId<SystemStructureEntityLinkId>("sel_test-link");
const CHILD_ID = brandId<SystemStructureEntityId>("sse_child");
const PARENT_ID = brandId<SystemStructureEntityId>("sse_parent");
const AUTH = makeTestAuth({ systemId: SYSTEM_ID });
const mockAudit = vi.fn().mockResolvedValue(undefined);

const validCreatePayload = {
  entityId: CHILD_ID,
  parentEntityId: PARENT_ID,
  sortOrder: 0,
};

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
    it("creates a root link (null parent) without CTE queries", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([makeLinkRow({ parentEntityId: null })]);

      const result = await createEntityLink(
        db,
        SYSTEM_ID,
        { entityId: CHILD_ID, parentEntityId: null, sortOrder: 0 },
        AUTH,
        mockAudit,
      );

      expect(result.id).toBe(LINK_ID);
      expect(result.parentEntityId).toBeNull();
      expect(chain.insert).toHaveBeenCalled();
      expect(mockAudit).toHaveBeenCalledWith(
        chain,
        expect.objectContaining({ eventType: "structure-entity-link.created" }),
      );
      expect(chain.execute).toHaveBeenCalledTimes(1);
    });

    it("creates a link with non-null parent when no cycle and depth ok", async () => {
      const { db, chain } = mockDb();
      chain.execute
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([{ count: "0" }])
        .mockResolvedValueOnce([{ count: "3" }]);
      chain.returning.mockResolvedValueOnce([makeLinkRow()]);

      const result = await createEntityLink(db, SYSTEM_ID, validCreatePayload, AUTH, mockAudit);

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
      const SAME = brandId<SystemStructureEntityId>("sse_same");

      await expect(
        createEntityLink(
          db,
          SYSTEM_ID,
          { entityId: SAME, parentEntityId: SAME, sortOrder: 0 },
          AUTH,
          mockAudit,
        ),
      ).rejects.toThrow(expect.objectContaining({ status: 409, code: "CYCLE_DETECTED" }));
    });

    it("throws CYCLE_DETECTED when ancestor CTE finds a cycle", async () => {
      const { db, chain } = mockDb();
      chain.execute.mockResolvedValueOnce(undefined).mockResolvedValueOnce([{ count: "1" }]);

      await expect(
        createEntityLink(db, SYSTEM_ID, validCreatePayload, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 409, code: "CYCLE_DETECTED" }));
    });

    it("throws MAX_DEPTH_EXCEEDED when depth >= 50", async () => {
      const { db, chain } = mockDb();
      chain.execute
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([{ count: "0" }])
        .mockResolvedValueOnce([{ count: "50" }]);

      await expect(
        createEntityLink(db, SYSTEM_ID, validCreatePayload, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 409, code: "MAX_DEPTH_EXCEEDED" }));
    });

    it("throws MAX_DEPTH_EXCEEDED when depth exceeds 50", async () => {
      const { db, chain } = mockDb();
      chain.execute
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([{ count: "0" }])
        .mockResolvedValueOnce([{ count: "99" }]);

      await expect(
        createEntityLink(db, SYSTEM_ID, validCreatePayload, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 409, code: "MAX_DEPTH_EXCEEDED" }));
    });

    it("creates a link when depth is exactly at boundary (49)", async () => {
      const { db, chain } = mockDb();
      chain.execute
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([{ count: "0" }])
        .mockResolvedValueOnce([{ count: "49" }]);
      chain.returning.mockResolvedValueOnce([makeLinkRow()]);

      const result = await createEntityLink(db, SYSTEM_ID, validCreatePayload, AUTH, mockAudit);

      expect(result.id).toBe(LINK_ID);
      expect(chain.insert).toHaveBeenCalled();
    });

    it("throws when INSERT returns no rows", async () => {
      const { db, chain } = mockDb();
      chain.execute
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([{ count: "0" }])
        .mockResolvedValueOnce([{ count: "3" }]);
      chain.returning.mockResolvedValueOnce([]);

      await expect(
        createEntityLink(db, SYSTEM_ID, validCreatePayload, AUTH, mockAudit),
      ).rejects.toThrow("Failed to create entity link — INSERT returned no rows");
    });

    it("throws 404 on ownership failure", async () => {
      const { db } = mockDb();
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));

      await expect(
        createEntityLink(db, SYSTEM_ID, validCreatePayload, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
    });
  });

  // ── updateEntityLink ───────────────────────────────────────────

  describe("updateEntityLink", () => {
    it("updates sortOrder and returns result", async () => {
      const { db, chain } = mockDb();
      chain.where.mockReturnValueOnce(chain);
      chain.limit.mockReturnValueOnce(chain);
      chain.for.mockResolvedValueOnce([{ id: LINK_ID }]);
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
