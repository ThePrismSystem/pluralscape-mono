import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted mocks for dispatch-style external services. This same block lives at
// the top of every router integration test file. Keep these BEFORE any
// module-level import that could transitively pull in the real implementations.
vi.mock("../../../services/webhook-dispatcher.js", () => ({
  dispatchWebhookEvent: vi.fn().mockResolvedValue([]),
  invalidateWebhookConfigCache: vi.fn(),
  clearWebhookConfigCache: vi.fn(),
}));
vi.mock("../../../middleware/rate-limit.js", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
}));

import { structureRouter } from "../../../trpc/routers/structure.js";
import { testEncryptedDataBase64 } from "../../helpers/integration-setup.js";
import {
  expectAuthRequired,
  expectTenantDenied,
  seedAccountAndSystem,
  seedMember,
  seedSecondTenant,
  seedStructureEntity,
  setupRouterIntegration,
  truncateAll,
  type RouterIntegrationCtx,
  type SeededTenant,
} from "../integration-helpers.js";
import { makeIntegrationCallerFactory } from "../test-helpers.js";

import type { SystemStructureEntityTypeId } from "@pluralscape/types";

/** Initial version returned by createEntityType / createStructureEntity; required input for `update`. */
const INITIAL_VERSION = 1;

/** Default sortOrder used across structure inputs. */
const DEFAULT_SORT_ORDER = 0;

/** Larger sortOrder used to vary update payloads. */
const NEXT_SORT_ORDER = 1;

describe("structure router integration", () => {
  let ctx: RouterIntegrationCtx;
  let makeCaller: ReturnType<
    typeof makeIntegrationCallerFactory<{ structure: typeof structureRouter }>
  >;
  let primary: SeededTenant;
  let other: SeededTenant;

  beforeAll(async () => {
    ctx = await setupRouterIntegration();
    makeCaller = makeIntegrationCallerFactory({ structure: structureRouter }, ctx.db);
  });

  afterAll(async () => {
    await ctx.teardown();
  });

  beforeEach(async () => {
    primary = await seedAccountAndSystem(ctx.db);
    other = await seedSecondTenant(ctx.db);
  });

  afterEach(async () => {
    await truncateAll(ctx);
  });

  /**
   * Create an entity type via the caller and return its branded id.
   * Used by tests that need a type id without an associated entity (e.g. delete),
   * since `seedStructureEntity` always creates an entity referencing its type.
   */
  async function createEntityTypeViaCaller(
    tenant: SeededTenant,
  ): Promise<SystemStructureEntityTypeId> {
    const caller = makeCaller(tenant.auth);
    const result = await caller.structure.entityType.create({
      systemId: tenant.systemId,
      encryptedData: testEncryptedDataBase64(),
      sortOrder: DEFAULT_SORT_ORDER,
    });
    return result.id;
  }

  // ── Entity Types ───────────────────────────────────────────────────

  describe("structure.entityType.create", () => {
    it("creates an entity type belonging to the caller's system", async () => {
      const caller = makeCaller(primary.auth);
      const result = await caller.structure.entityType.create({
        systemId: primary.systemId,
        encryptedData: testEncryptedDataBase64(),
        sortOrder: DEFAULT_SORT_ORDER,
      });
      expect(result.systemId).toBe(primary.systemId);
      expect(result.id).toMatch(/^stet_/);
    });
  });

  describe("structure.entityType.get", () => {
    it("returns an entity type by id", async () => {
      const entityTypeId = await createEntityTypeViaCaller(primary);
      const caller = makeCaller(primary.auth);
      const result = await caller.structure.entityType.get({
        systemId: primary.systemId,
        entityTypeId,
      });
      expect(result.id).toBe(entityTypeId);
    });
  });

  describe("structure.entityType.list", () => {
    it("returns entity types of the caller's system", async () => {
      await createEntityTypeViaCaller(primary);
      await createEntityTypeViaCaller(primary);
      const caller = makeCaller(primary.auth);
      // listEntityTypes returns PaginatedResult<EntityTypeResult> ⇒ `data`, not `items`.
      const result = await caller.structure.entityType.list({ systemId: primary.systemId });
      expect(result.data.length).toBe(2);
    });
  });

  describe("structure.entityType.update", () => {
    it("updates an entity type's encrypted data and sort order", async () => {
      const entityTypeId = await createEntityTypeViaCaller(primary);
      const caller = makeCaller(primary.auth);
      // UpdateStructureEntityTypeBodySchema requires `version` (optimistic
      // concurrency token); newly created types start at version 1.
      const result = await caller.structure.entityType.update({
        systemId: primary.systemId,
        entityTypeId,
        encryptedData: testEncryptedDataBase64(),
        sortOrder: NEXT_SORT_ORDER,
        version: INITIAL_VERSION,
      });
      expect(result.id).toBe(entityTypeId);
    });
  });

  describe("structure.entityType.archive", () => {
    it("archives an entity type", async () => {
      const entityTypeId = await createEntityTypeViaCaller(primary);
      const caller = makeCaller(primary.auth);
      const result = await caller.structure.entityType.archive({
        systemId: primary.systemId,
        entityTypeId,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("structure.entityType.restore", () => {
    it("restores an archived entity type", async () => {
      const entityTypeId = await createEntityTypeViaCaller(primary);
      const caller = makeCaller(primary.auth);
      await caller.structure.entityType.archive({
        systemId: primary.systemId,
        entityTypeId,
      });
      const restored = await caller.structure.entityType.restore({
        systemId: primary.systemId,
        entityTypeId,
      });
      expect(restored.id).toBe(entityTypeId);
    });
  });

  describe("structure.entityType.delete", () => {
    it("deletes an entity type with no referencing entities", async () => {
      // deleteEntityType 409s when entities still reference the type, so we
      // create a fresh type via the caller (no associated entity) rather than
      // reusing the one seedStructureEntity creates internally.
      const entityTypeId = await createEntityTypeViaCaller(primary);
      const caller = makeCaller(primary.auth);
      const result = await caller.structure.entityType.delete({
        systemId: primary.systemId,
        entityTypeId,
      });
      expect(result.success).toBe(true);
    });
  });

  // ── Structure Entities ─────────────────────────────────────────────

  describe("structure.entity.create", () => {
    it("creates a structure entity belonging to the caller's system", async () => {
      const entityTypeId = await createEntityTypeViaCaller(primary);
      const caller = makeCaller(primary.auth);
      const result = await caller.structure.entity.create({
        systemId: primary.systemId,
        structureEntityTypeId: entityTypeId,
        encryptedData: testEncryptedDataBase64(),
        parentEntityId: null,
        sortOrder: DEFAULT_SORT_ORDER,
      });
      expect(result.systemId).toBe(primary.systemId);
      expect(result.id).toMatch(/^ste_/);
    });
  });

  describe("structure.entity.get", () => {
    it("returns an entity by id", async () => {
      const entityId = await seedStructureEntity(ctx.db, primary.systemId, primary.auth);
      const caller = makeCaller(primary.auth);
      const result = await caller.structure.entity.get({
        systemId: primary.systemId,
        entityId,
      });
      expect(result.id).toBe(entityId);
    });
  });

  describe("structure.entity.getHierarchy", () => {
    it("returns NOT_FOUND when the entity does not exist", async () => {
      // The happy-path branch executes a recursive CTE via tx.execute(sql\`…\`)
      // whose result shape differs between postgres-js (returns the rows array
      // directly) and pglite (returns { rows: [...] }). Service-level unit
      // tests already cover the happy path with mocked execute(); here we
      // assert the procedure wiring + middleware by exercising the missing-
      // entity short-circuit, which throws NOT_FOUND before reaching the CTE.
      const entityId = `ste_${crypto.randomUUID()}`;
      const caller = makeCaller(primary.auth);
      await expect(
        caller.structure.entity.getHierarchy({
          systemId: primary.systemId,
          entityId,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  describe("structure.entity.list", () => {
    it("returns entities of the caller's system", async () => {
      await seedStructureEntity(ctx.db, primary.systemId, primary.auth);
      await seedStructureEntity(ctx.db, primary.systemId, primary.auth);
      const caller = makeCaller(primary.auth);
      // listStructureEntities returns PaginatedResult<StructureEntityResult>.
      const result = await caller.structure.entity.list({ systemId: primary.systemId });
      expect(result.data.length).toBe(2);
    });
  });

  describe("structure.entity.update", () => {
    it("updates an entity's encrypted data and sort order", async () => {
      const entityId = await seedStructureEntity(ctx.db, primary.systemId, primary.auth);
      const caller = makeCaller(primary.auth);
      // UpdateStructureEntityBodySchema requires `version`; newly seeded
      // entities start at version 1.
      const result = await caller.structure.entity.update({
        systemId: primary.systemId,
        entityId,
        encryptedData: testEncryptedDataBase64(),
        parentEntityId: null,
        sortOrder: NEXT_SORT_ORDER,
        version: INITIAL_VERSION,
      });
      expect(result.id).toBe(entityId);
    });
  });

  describe("structure.entity.archive", () => {
    it("archives an entity", async () => {
      const entityId = await seedStructureEntity(ctx.db, primary.systemId, primary.auth);
      const caller = makeCaller(primary.auth);
      const result = await caller.structure.entity.archive({
        systemId: primary.systemId,
        entityId,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("structure.entity.restore", () => {
    it("restores an archived entity", async () => {
      const entityId = await seedStructureEntity(ctx.db, primary.systemId, primary.auth);
      const caller = makeCaller(primary.auth);
      await caller.structure.entity.archive({
        systemId: primary.systemId,
        entityId,
      });
      const restored = await caller.structure.entity.restore({
        systemId: primary.systemId,
        entityId,
      });
      expect(restored.id).toBe(entityId);
    });
  });

  describe("structure.entity.delete", () => {
    it("deletes an entity with no junction-table dependents", async () => {
      // seedStructureEntity creates an entity but does not add link, member-link,
      // or association rows referencing it, so deleteStructureEntity's
      // dependent-count guard passes.
      const entityId = await seedStructureEntity(ctx.db, primary.systemId, primary.auth);
      const caller = makeCaller(primary.auth);
      const result = await caller.structure.entity.delete({
        systemId: primary.systemId,
        entityId,
      });
      expect(result.success).toBe(true);
    });
  });

  // ── Entity Links ───────────────────────────────────────────────────

  describe("structure.link.create", () => {
    it("creates a link between two entities in the same system", async () => {
      const childId = await seedStructureEntity(ctx.db, primary.systemId, primary.auth);
      const parentId = await seedStructureEntity(ctx.db, primary.systemId, primary.auth);
      const caller = makeCaller(primary.auth);
      const result = await caller.structure.link.create({
        systemId: primary.systemId,
        entityId: childId,
        parentEntityId: parentId,
        sortOrder: DEFAULT_SORT_ORDER,
      });
      expect(result.entityId).toBe(childId);
      expect(result.parentEntityId).toBe(parentId);
      expect(result.id).toMatch(/^stel_/);
    });
  });

  describe("structure.link.list", () => {
    it("returns links for the caller's system", async () => {
      const childId = await seedStructureEntity(ctx.db, primary.systemId, primary.auth);
      const parentId = await seedStructureEntity(ctx.db, primary.systemId, primary.auth);
      const caller = makeCaller(primary.auth);
      await caller.structure.link.create({
        systemId: primary.systemId,
        entityId: childId,
        parentEntityId: parentId,
        sortOrder: DEFAULT_SORT_ORDER,
      });
      const result = await caller.structure.link.list({ systemId: primary.systemId });
      expect(result.data.length).toBe(1);
    });
  });

  describe("structure.link.update", () => {
    it("updates a link's sort order", async () => {
      const childId = await seedStructureEntity(ctx.db, primary.systemId, primary.auth);
      const parentId = await seedStructureEntity(ctx.db, primary.systemId, primary.auth);
      const caller = makeCaller(primary.auth);
      const link = await caller.structure.link.create({
        systemId: primary.systemId,
        entityId: childId,
        parentEntityId: parentId,
        sortOrder: DEFAULT_SORT_ORDER,
      });
      const result = await caller.structure.link.update({
        systemId: primary.systemId,
        linkId: link.id,
        sortOrder: NEXT_SORT_ORDER,
      });
      expect(result.id).toBe(link.id);
      expect(result.sortOrder).toBe(NEXT_SORT_ORDER);
    });
  });

  describe("structure.link.delete", () => {
    it("deletes a link", async () => {
      const childId = await seedStructureEntity(ctx.db, primary.systemId, primary.auth);
      const parentId = await seedStructureEntity(ctx.db, primary.systemId, primary.auth);
      const caller = makeCaller(primary.auth);
      const link = await caller.structure.link.create({
        systemId: primary.systemId,
        entityId: childId,
        parentEntityId: parentId,
        sortOrder: DEFAULT_SORT_ORDER,
      });
      const result = await caller.structure.link.delete({
        systemId: primary.systemId,
        linkId: link.id,
      });
      expect(result.success).toBe(true);
    });
  });

  // ── Entity Member Links ────────────────────────────────────────────

  describe("structure.memberLink.create", () => {
    it("creates a member link under a parent entity", async () => {
      const parentEntityId = await seedStructureEntity(ctx.db, primary.systemId, primary.auth);
      const memberId = await seedMember(ctx.db, primary.systemId, primary.auth);
      const caller = makeCaller(primary.auth);
      const result = await caller.structure.memberLink.create({
        systemId: primary.systemId,
        parentEntityId,
        memberId,
        sortOrder: DEFAULT_SORT_ORDER,
      });
      expect(result.memberId).toBe(memberId);
      expect(result.parentEntityId).toBe(parentEntityId);
      expect(result.id).toMatch(/^steml_/);
    });
  });

  describe("structure.memberLink.list", () => {
    it("returns member links for the caller's system", async () => {
      const parentEntityId = await seedStructureEntity(ctx.db, primary.systemId, primary.auth);
      const memberId = await seedMember(ctx.db, primary.systemId, primary.auth);
      const caller = makeCaller(primary.auth);
      await caller.structure.memberLink.create({
        systemId: primary.systemId,
        parentEntityId,
        memberId,
        sortOrder: DEFAULT_SORT_ORDER,
      });
      const result = await caller.structure.memberLink.list({ systemId: primary.systemId });
      expect(result.data.length).toBe(1);
    });
  });

  describe("structure.memberLink.delete", () => {
    it("deletes a member link", async () => {
      const parentEntityId = await seedStructureEntity(ctx.db, primary.systemId, primary.auth);
      const memberId = await seedMember(ctx.db, primary.systemId, primary.auth);
      const caller = makeCaller(primary.auth);
      const memberLink = await caller.structure.memberLink.create({
        systemId: primary.systemId,
        parentEntityId,
        memberId,
        sortOrder: DEFAULT_SORT_ORDER,
      });
      const result = await caller.structure.memberLink.delete({
        systemId: primary.systemId,
        memberLinkId: memberLink.id,
      });
      expect(result.success).toBe(true);
    });
  });

  // ── Entity Associations ────────────────────────────────────────────

  describe("structure.association.create", () => {
    it("creates an association between two entities", async () => {
      const sourceEntityId = await seedStructureEntity(ctx.db, primary.systemId, primary.auth);
      const targetEntityId = await seedStructureEntity(ctx.db, primary.systemId, primary.auth);
      const caller = makeCaller(primary.auth);
      const result = await caller.structure.association.create({
        systemId: primary.systemId,
        sourceEntityId,
        targetEntityId,
      });
      expect(result.sourceEntityId).toBe(sourceEntityId);
      expect(result.targetEntityId).toBe(targetEntityId);
      expect(result.id).toMatch(/^stea_/);
    });
  });

  describe("structure.association.list", () => {
    it("returns associations for the caller's system", async () => {
      const sourceEntityId = await seedStructureEntity(ctx.db, primary.systemId, primary.auth);
      const targetEntityId = await seedStructureEntity(ctx.db, primary.systemId, primary.auth);
      const caller = makeCaller(primary.auth);
      await caller.structure.association.create({
        systemId: primary.systemId,
        sourceEntityId,
        targetEntityId,
      });
      const result = await caller.structure.association.list({ systemId: primary.systemId });
      expect(result.data.length).toBe(1);
    });
  });

  describe("structure.association.delete", () => {
    it("deletes an association", async () => {
      const sourceEntityId = await seedStructureEntity(ctx.db, primary.systemId, primary.auth);
      const targetEntityId = await seedStructureEntity(ctx.db, primary.systemId, primary.auth);
      const caller = makeCaller(primary.auth);
      const association = await caller.structure.association.create({
        systemId: primary.systemId,
        sourceEntityId,
        targetEntityId,
      });
      const result = await caller.structure.association.delete({
        systemId: primary.systemId,
        associationId: association.id,
      });
      expect(result.success).toBe(true);
    });
  });

  // ── Auth-failure: one test for the whole router ────────────────────

  describe("auth", () => {
    it("rejects unauthenticated calls with UNAUTHORIZED", async () => {
      const caller = makeCaller(null);
      await expectAuthRequired(caller.structure.entityType.list({ systemId: primary.systemId }));
    });
  });

  // ── Tenant isolation: one test per major namespace ────────────────

  describe("tenant isolation", () => {
    it("rejects when primary tries to read other tenant's entity", async () => {
      const otherEntityId = await seedStructureEntity(ctx.db, other.systemId, other.auth);
      const caller = makeCaller(primary.auth);
      await expectTenantDenied(
        caller.structure.entity.get({
          systemId: other.systemId,
          entityId: otherEntityId,
        }),
      );
    });

    it("rejects when primary tries to read other tenant's entity type", async () => {
      const otherEntityTypeId = await createEntityTypeViaCaller(other);
      const caller = makeCaller(primary.auth);
      await expectTenantDenied(
        caller.structure.entityType.get({
          systemId: other.systemId,
          entityTypeId: otherEntityTypeId,
        }),
      );
    });
  });
});
