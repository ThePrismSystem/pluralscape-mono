import { brandId } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../helpers/mock-db.js";
import { mockOwnershipFailure } from "../helpers/mock-ownership.js";
import { makeTestAuth } from "../helpers/test-auth.js";

import type { MemberId, SystemId, SystemStructureEntityMemberLinkId } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock("../../lib/system-ownership.js", () => ({
  assertSystemOwnership: vi.fn(),
}));

vi.mock("@pluralscape/db/pg", () => ({
  systemStructureEntityMemberLinks: {
    id: "id",
    systemId: "system_id",
    parentEntityId: "parent_entity_id",
    memberId: "member_id",
    sortOrder: "sort_order",
    createdAt: "created_at",
  },
}));

vi.mock("@pluralscape/types", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@pluralscape/types")>();
  return {
    ...actual,
    createId: vi.fn().mockReturnValue("seml_test-id"),
    now: vi.fn().mockReturnValue(1000),
  };
});

vi.mock("@pluralscape/validation", () => ({
  CreateStructureEntityMemberLinkBodySchema: {
    safeParse: vi.fn().mockReturnValue({
      success: true,
      data: { parentEntityId: "sse_parent", memberId: "mem_test", sortOrder: 0 },
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

const { assertSystemOwnership } = await import("../../lib/system-ownership.js");
const { CreateStructureEntityMemberLinkBodySchema } = await import("@pluralscape/validation");

const { createEntityMemberLink, listEntityMemberLinks, deleteEntityMemberLink } =
  await import("../../services/structure-entity-member-link.service.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const SYSTEM_ID = brandId<SystemId>("sys_test-system");
const LINK_ID = brandId<SystemStructureEntityMemberLinkId>("seml_test-link");
const MEMBER_ID = brandId<MemberId>("mem_test");
const AUTH = makeTestAuth({ systemId: SYSTEM_ID });
const mockAudit = vi.fn().mockResolvedValue(undefined);

function makeMemberLinkRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: LINK_ID,
    systemId: SYSTEM_ID,
    parentEntityId: "sse_parent",
    memberId: MEMBER_ID,
    sortOrder: 0,
    createdAt: 1000,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe("structure-entity-member-link service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  // ── createEntityMemberLink ────────────────────────────────────

  describe("createEntityMemberLink", () => {
    const validPayload = { parentEntityId: "sse_parent", memberId: MEMBER_ID, sortOrder: 0 };

    it("creates a member link and audits the addition", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([makeMemberLinkRow()]);

      const result = await createEntityMemberLink(db, SYSTEM_ID, validPayload, AUTH, mockAudit);

      expect(result.id).toBe(LINK_ID);
      expect(result.memberId).toBe(MEMBER_ID);
      expect(result.parentEntityId).toBe("sse_parent");
      expect(result.sortOrder).toBe(0);
      expect(chain.insert).toHaveBeenCalled();
      expect(mockAudit).toHaveBeenCalledWith(
        chain,
        expect.objectContaining({ eventType: "structure-entity-member-link.added" }),
      );
    });

    it("throws VALIDATION_ERROR for invalid payload", async () => {
      const { db } = mockDb();
      const schema = vi.mocked(CreateStructureEntityMemberLinkBodySchema);
      (schema.safeParse as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        success: false,
        error: { issues: [] },
      });

      await expect(createEntityMemberLink(db, SYSTEM_ID, {}, AUTH, mockAudit)).rejects.toThrow(
        expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }),
      );
    });

    it("throws when INSERT returns no rows", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([]);

      await expect(
        createEntityMemberLink(db, SYSTEM_ID, validPayload, AUTH, mockAudit),
      ).rejects.toThrow("Failed to create entity member link — INSERT returned no rows");
    });

    it("throws 404 on ownership failure", async () => {
      const { db } = mockDb();
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));

      await expect(
        createEntityMemberLink(db, SYSTEM_ID, validPayload, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
    });
  });

  // ── listEntityMemberLinks ─────────────────────────────────────

  describe("listEntityMemberLinks", () => {
    it("returns paginated results with defaults", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([makeMemberLinkRow()]);

      const result = await listEntityMemberLinks(db, SYSTEM_ID, AUTH);

      expect(result.data).toHaveLength(1);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });

    it("returns empty list when no rows", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([]);

      const result = await listEntityMemberLinks(db, SYSTEM_ID, AUTH);

      expect(result.data).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });

    it("applies cursor filter", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([makeMemberLinkRow({ id: "seml_after" })]);

      const result = await listEntityMemberLinks(db, SYSTEM_ID, AUTH, {
        cursor: "seml_before",
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.id).toBe("seml_after");
    });

    it("applies custom limit and detects hasMore", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([
        makeMemberLinkRow({ id: "seml_1" }),
        makeMemberLinkRow({ id: "seml_2" }),
      ]);

      const result = await listEntityMemberLinks(db, SYSTEM_ID, AUTH, { limit: 1 });

      expect(result.data).toHaveLength(1);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).not.toBeNull();
    });

    it("throws 404 on ownership failure", async () => {
      const { db } = mockDb();
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));

      await expect(listEntityMemberLinks(db, SYSTEM_ID, AUTH)).rejects.toThrow(
        expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
      );
    });
  });

  // ── deleteEntityMemberLink ────────────────────────────────────

  describe("deleteEntityMemberLink", () => {
    it("deletes member link when found and audits the removal", async () => {
      const { db, chain } = mockDb();
      chain.where.mockReturnValueOnce(chain);
      chain.limit.mockReturnValueOnce(chain);
      chain.for.mockResolvedValueOnce([{ id: LINK_ID }]);

      await expect(
        deleteEntityMemberLink(db, SYSTEM_ID, LINK_ID, AUTH, mockAudit),
      ).resolves.toBeUndefined();
      expect(mockAudit).toHaveBeenCalledWith(
        chain,
        expect.objectContaining({ eventType: "structure-entity-member-link.removed" }),
      );
    });

    it("throws NOT_FOUND when link does not exist", async () => {
      const { db, chain } = mockDb();
      chain.where.mockReturnValueOnce(chain);
      chain.limit.mockReturnValueOnce(chain);
      chain.for.mockResolvedValueOnce([]);

      await expect(
        deleteEntityMemberLink(db, SYSTEM_ID, "seml_missing", AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
    });

    it("throws 404 on ownership failure", async () => {
      const { db } = mockDb();
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));

      await expect(deleteEntityMemberLink(db, SYSTEM_ID, LINK_ID, AUTH, mockAudit)).rejects.toThrow(
        expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
      );
    });
  });
});
