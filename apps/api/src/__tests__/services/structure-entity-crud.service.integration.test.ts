import { PGlite } from "@electric-sql/pglite";
import * as schema from "@pluralscape/db/pg";
import {
  createPgStructureTables,
  pgInsertAccount,
  pgInsertMember,
  pgInsertSystem,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  archiveStructureEntity,
  createStructureEntity,
  deleteStructureEntity,
  getStructureEntity,
  listStructureEntities,
  restoreStructureEntity,
  updateStructureEntity,
} from "../../services/structure-entity-crud.service.js";
import {
  createEntityType,
  deleteEntityType,
} from "../../services/structure-entity-type.service.js";
import {
  asDb,
  assertApiError,
  genAccountId,
  makeAuth,
  noopAudit,
  spyAudit,
  testEncryptedDataBase64,
} from "../helpers/integration-setup.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type {
  AccountId,
  MemberId,
  SystemId,
  SystemStructureEntityTypeId,
} from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const {
  systemStructureEntities,
  systemStructureEntityTypes,
  systemStructureEntityLinks,
  systemStructureEntityMemberLinks,
  systemStructureEntityAssociations,
} = schema;

describe("structure-entity-crud.service (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let accountId: AccountId;
  let systemId: SystemId;
  let auth: AuthContext;
  let entityTypeId: SystemStructureEntityTypeId;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgStructureTables(client);

    accountId = (await pgInsertAccount(db)) as AccountId;
    systemId = (await pgInsertSystem(db, accountId)) as SystemId;
    auth = makeAuth(accountId, systemId);

    // Create an entity type to use in all tests
    const typeResult = await createEntityType(
      asDb(db),
      systemId,
      { encryptedData: testEncryptedDataBase64(), sortOrder: 0 },
      auth,
      noopAudit,
    );
    entityTypeId = typeResult.id;
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(systemStructureEntityAssociations);
    await db.delete(systemStructureEntityMemberLinks);
    await db.delete(systemStructureEntityLinks);
    await db.delete(systemStructureEntities);
  });

  function entityParams(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      structureEntityTypeId: entityTypeId,
      encryptedData: testEncryptedDataBase64(),
      parentEntityId: null,
      sortOrder: 0,
      ...overrides,
    };
  }

  // ── createStructureEntity ───────────────────────────────────────────

  describe("createStructureEntity", () => {
    it("creates an entity with correct fields and audit event", async () => {
      const audit = spyAudit();
      const result = await createStructureEntity(asDb(db), systemId, entityParams(), auth, audit);

      expect(result.id).toMatch(/^ste_/);
      expect(result.systemId).toBe(systemId);
      expect(result.entityTypeId).toBe(entityTypeId);
      expect(result.sortOrder).toBe(0);
      expect(result.version).toBe(1);
      expect(result.archived).toBe(false);
      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("structure-entity.created");
    });

    it("auto-creates a link when parentEntityId is provided", async () => {
      const parent = await createStructureEntity(
        asDb(db),
        systemId,
        entityParams(),
        auth,
        noopAudit,
      );

      const child = await createStructureEntity(
        asDb(db),
        systemId,
        entityParams({ parentEntityId: parent.id }),
        auth,
        noopAudit,
      );

      expect(child.id).toBeDefined();

      // Verify the link was created
      const links = await db
        .select()
        .from(systemStructureEntityLinks)
        .where(
          and(
            eq(systemStructureEntityLinks.entityId, child.id),
            eq(systemStructureEntityLinks.parentEntityId, parent.id),
          ),
        );
      expect(links).toHaveLength(1);
    });

    it("rejects when entity type does not exist", async () => {
      await assertApiError(
        createStructureEntity(
          asDb(db),
          systemId,
          entityParams({ structureEntityTypeId: `stet_${crypto.randomUUID()}` }),
          auth,
          noopAudit,
        ),
        "NOT_FOUND",
        404,
        "Structure entity type not found",
      );
    });

    it("rejects cross-system access", async () => {
      const otherAccountId = genAccountId();
      const otherSystemId = `sys_${crypto.randomUUID()}` as SystemId;
      const otherAuth = makeAuth(otherAccountId, otherSystemId);

      await assertApiError(
        createStructureEntity(asDb(db), systemId, entityParams(), otherAuth, noopAudit),
        "NOT_FOUND",
        404,
      );
    });
  });

  // ── getStructureEntity ──────────────────────────────────────────────

  describe("getStructureEntity", () => {
    it("returns an entity by id", async () => {
      const created = await createStructureEntity(
        asDb(db),
        systemId,
        entityParams(),
        auth,
        noopAudit,
      );

      const fetched = await getStructureEntity(asDb(db), systemId, created.id, auth);
      expect(fetched.id).toBe(created.id);
      expect(fetched.entityTypeId).toBe(entityTypeId);
    });

    it("throws NOT_FOUND for nonexistent entity", async () => {
      const missingId =
        `ste_${crypto.randomUUID()}` as import("@pluralscape/types").SystemStructureEntityId;
      await assertApiError(
        getStructureEntity(asDb(db), systemId, missingId, auth),
        "NOT_FOUND",
        404,
      );
    });
  });

  // ── listStructureEntities ───────────────────────────────────────────

  describe("listStructureEntities", () => {
    it("lists entities for a system", async () => {
      await createStructureEntity(asDb(db), systemId, entityParams(), auth, noopAudit);
      await createStructureEntity(
        asDb(db),
        systemId,
        entityParams({ sortOrder: 1 }),
        auth,
        noopAudit,
      );

      const result = await listStructureEntities(asDb(db), systemId, auth);
      expect(result.data).toHaveLength(2);
    });

    it("filters by entityTypeId", async () => {
      const otherType = await createEntityType(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), sortOrder: 1 },
        auth,
        noopAudit,
      );

      await createStructureEntity(asDb(db), systemId, entityParams(), auth, noopAudit);
      await createStructureEntity(
        asDb(db),
        systemId,
        entityParams({ structureEntityTypeId: otherType.id }),
        auth,
        noopAudit,
      );

      const result = await listStructureEntities(asDb(db), systemId, auth, {
        entityTypeId: otherType.id,
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.entityTypeId).toBe(otherType.id);

      // Clean up extra type's entities
      await db.delete(systemStructureEntities);
      await db
        .delete(systemStructureEntityTypes)
        .where(eq(systemStructureEntityTypes.id, otherType.id));
    });

    it("excludes archived entities by default", async () => {
      const entity = await createStructureEntity(
        asDb(db),
        systemId,
        entityParams(),
        auth,
        noopAudit,
      );
      await archiveStructureEntity(asDb(db), systemId, entity.id, auth, noopAudit);

      const result = await listStructureEntities(asDb(db), systemId, auth);
      expect(result.data).toHaveLength(0);
    });

    it("includes archived entities when requested", async () => {
      const entity = await createStructureEntity(
        asDb(db),
        systemId,
        entityParams(),
        auth,
        noopAudit,
      );
      await archiveStructureEntity(asDb(db), systemId, entity.id, auth, noopAudit);

      const result = await listStructureEntities(asDb(db), systemId, auth, {
        includeArchived: true,
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.archived).toBe(true);
    });
  });

  // ── updateStructureEntity ───────────────────────────────────────────

  describe("updateStructureEntity", () => {
    it("updates encryptedData and sortOrder", async () => {
      const created = await createStructureEntity(
        asDb(db),
        systemId,
        entityParams(),
        auth,
        noopAudit,
      );

      const audit = spyAudit();
      const updated = await updateStructureEntity(
        asDb(db),
        systemId,
        created.id,
        {
          encryptedData: testEncryptedDataBase64(),
          parentEntityId: null,
          sortOrder: 5,
          version: 1,
        },
        auth,
        audit,
      );

      expect(updated.sortOrder).toBe(5);
      expect(updated.version).toBe(2);
      expect(audit.calls[0]?.eventType).toBe("structure-entity.updated");
    });

    it("rejects stale version (OCC)", async () => {
      const created = await createStructureEntity(
        asDb(db),
        systemId,
        entityParams(),
        auth,
        noopAudit,
      );

      await assertApiError(
        updateStructureEntity(
          asDb(db),
          systemId,
          created.id,
          {
            encryptedData: testEncryptedDataBase64(),
            parentEntityId: null,
            sortOrder: 1,
            version: 99,
          },
          auth,
          noopAudit,
        ),
        "CONFLICT",
        409,
      );
    });
  });

  // ── deleteStructureEntity ───────────────────────────────────────────

  describe("deleteStructureEntity", () => {
    it("deletes an entity with no dependents", async () => {
      const created = await createStructureEntity(
        asDb(db),
        systemId,
        entityParams(),
        auth,
        noopAudit,
      );
      const audit = spyAudit();
      await deleteStructureEntity(asDb(db), systemId, created.id, auth, audit);

      await assertApiError(
        getStructureEntity(asDb(db), systemId, created.id, auth),
        "NOT_FOUND",
        404,
      );
      expect(audit.calls[0]?.eventType).toBe("structure-entity.deleted");
    });

    it("rejects deletion when entity has entity links", async () => {
      const parent = await createStructureEntity(
        asDb(db),
        systemId,
        entityParams(),
        auth,
        noopAudit,
      );
      // Create a child linked to parent
      await createStructureEntity(
        asDb(db),
        systemId,
        entityParams({ parentEntityId: parent.id }),
        auth,
        noopAudit,
      );

      await assertApiError(
        deleteStructureEntity(asDb(db), systemId, parent.id, auth, noopAudit),
        "HAS_DEPENDENTS",
        409,
        "has dependents",
      );
    });

    it("rejects deletion when entity has member links", async () => {
      const entity = await createStructureEntity(
        asDb(db),
        systemId,
        entityParams(),
        auth,
        noopAudit,
      );

      const memberId = (await pgInsertMember(db, systemId)) as MemberId;
      const now = Date.now();
      await db.insert(systemStructureEntityMemberLinks).values({
        id: `steml_${crypto.randomUUID()}`,
        systemId,
        parentEntityId: entity.id,
        memberId,
        sortOrder: 0,
        createdAt: now,
      });

      await assertApiError(
        deleteStructureEntity(asDb(db), systemId, entity.id, auth, noopAudit),
        "HAS_DEPENDENTS",
        409,
        "has dependents",
      );
    });

    it("rejects deletion when entity has associations", async () => {
      const entityA = await createStructureEntity(
        asDb(db),
        systemId,
        entityParams(),
        auth,
        noopAudit,
      );
      const entityB = await createStructureEntity(
        asDb(db),
        systemId,
        entityParams({ sortOrder: 1 }),
        auth,
        noopAudit,
      );

      await db.insert(systemStructureEntityAssociations).values({
        id: `stea_${crypto.randomUUID()}`,
        systemId,
        sourceEntityId: entityA.id,
        targetEntityId: entityB.id,
        createdAt: Date.now(),
      });

      await assertApiError(
        deleteStructureEntity(asDb(db), systemId, entityA.id, auth, noopAudit),
        "HAS_DEPENDENTS",
        409,
        "has dependents",
      );
    });

    it("throws NOT_FOUND for nonexistent entity", async () => {
      const missingId =
        `ste_${crypto.randomUUID()}` as import("@pluralscape/types").SystemStructureEntityId;
      await assertApiError(
        deleteStructureEntity(asDb(db), systemId, missingId, auth, noopAudit),
        "NOT_FOUND",
        404,
      );
    });
  });

  // ── archive / restore ────────────────────────────────────────────────

  describe("archive / restore", () => {
    it("archives and restores an entity", async () => {
      const created = await createStructureEntity(
        asDb(db),
        systemId,
        entityParams(),
        auth,
        noopAudit,
      );

      await archiveStructureEntity(asDb(db), systemId, created.id, auth, noopAudit);

      // Not visible via get
      await assertApiError(
        getStructureEntity(asDb(db), systemId, created.id, auth),
        "NOT_FOUND",
        404,
      );

      const restored = await restoreStructureEntity(
        asDb(db),
        systemId,
        created.id,
        auth,
        noopAudit,
      );
      expect(restored.id).toBe(created.id);
      expect(restored.archived).toBe(false);
      expect(restored.archivedAt).toBeNull();
    });
  });

  // ── Entity Type deletion with dependents ────────────────────────────

  describe("entity type deletion with entity dependents", () => {
    it("rejects entity type deletion when entities exist", async () => {
      // Create a second entity type for this test
      const tempType = await createEntityType(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), sortOrder: 10 },
        auth,
        noopAudit,
      );

      // Create an entity referencing the type
      await createStructureEntity(
        asDb(db),
        systemId,
        entityParams({ structureEntityTypeId: tempType.id }),
        auth,
        noopAudit,
      );

      await assertApiError(
        deleteEntityType(asDb(db), systemId, tempType.id, auth, noopAudit),
        "HAS_DEPENDENTS",
        409,
      );

      // Clean up
      await db.delete(systemStructureEntities);
      await db
        .delete(systemStructureEntityTypes)
        .where(eq(systemStructureEntityTypes.id, tempType.id));
    });

    it("allows entity type deletion when no entities reference it", async () => {
      const tempType = await createEntityType(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), sortOrder: 11 },
        auth,
        noopAudit,
      );

      // Delete should succeed with no entities
      await deleteEntityType(asDb(db), systemId, tempType.id, auth, noopAudit);
    });
  });
});
