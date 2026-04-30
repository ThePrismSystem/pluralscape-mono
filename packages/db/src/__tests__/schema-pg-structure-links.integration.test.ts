import { brandId } from "@pluralscape/types";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  systemStructureEntities,
  systemStructureEntityLinks,
  systemStructureEntityTypes,
} from "../schema/pg/structure.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import { testBlob } from "./helpers/pg-helpers.js";
import {
  newEntityId,
  newLinkId,
  newTypeId,
  setupStructureFixture,
  teardownStructureFixture,
  clearStructureTables,
  insertAccount as insertAccountWith,
  insertSystem as insertSystemWith,
  type StructureDb,
} from "./helpers/structure-fixtures.js";

import type { PGlite } from "@electric-sql/pglite";
import type { SystemStructureEntityId } from "@pluralscape/types";

describe("PG structure schema — entity links", () => {
  let client: PGlite;
  let db: StructureDb;

  const insertAccount = (id?: string) => insertAccountWith(db, id);
  const insertSystem = (accountId: string, id?: string) => insertSystemWith(db, accountId, id);

  beforeAll(async () => {
    const fixture = await setupStructureFixture();
    client = fixture.client;
    db = fixture.db;
  });

  afterAll(async () => {
    await teardownStructureFixture({ client, db });
  });

  afterEach(async () => {
    await clearStructureTables(db);
  });

  describe("systemStructureEntityLinks", () => {
    it("inserts and round-trips data", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const typeId = newTypeId();
      const entityId = newEntityId();
      const now = fixtureNow();

      await db.insert(systemStructureEntityTypes).values({
        id: typeId,
        systemId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(systemStructureEntities).values({
        id: entityId,
        systemId,
        entityTypeId: typeId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });

      const linkId = newLinkId();
      await db.insert(systemStructureEntityLinks).values({
        id: linkId,
        systemId,
        entityId,
        sortOrder: 0,
        createdAt: now,
      });

      const rows = await db
        .select()
        .from(systemStructureEntityLinks)
        .where(eq(systemStructureEntityLinks.id, linkId));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.entityId).toBe(entityId);
      expect(rows[0]?.parentEntityId).toBeNull();
    });

    it("rejects nonexistent entityId FK (RESTRICT)", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = fixtureNow();

      await expect(
        db.insert(systemStructureEntityLinks).values({
          id: newLinkId(),
          systemId,
          entityId: brandId<SystemStructureEntityId>("nonexistent"),
          sortOrder: 0,
          createdAt: now,
        }),
      ).rejects.toThrow();
    });

    it("prevents deletion of entity with dependent links (RESTRICT)", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const typeId = newTypeId();
      const entityId = newEntityId();
      const now = fixtureNow();

      await db.insert(systemStructureEntityTypes).values({
        id: typeId,
        systemId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(systemStructureEntities).values({
        id: entityId,
        systemId,
        entityTypeId: typeId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(systemStructureEntityLinks).values({
        id: newLinkId(),
        systemId,
        entityId,
        sortOrder: 0,
        createdAt: now,
      });

      await expect(
        db.delete(systemStructureEntities).where(eq(systemStructureEntities.id, entityId)),
      ).rejects.toThrow();
    });

    it("round-trips parentEntityId", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const typeId = newTypeId();
      const parentEntityId = newEntityId();
      const childEntityId = newEntityId();
      const now = fixtureNow();

      await db.insert(systemStructureEntityTypes).values({
        id: typeId,
        systemId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(systemStructureEntities).values([
        {
          id: parentEntityId,
          systemId,
          entityTypeId: typeId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        },
        {
          id: childEntityId,
          systemId,
          entityTypeId: typeId,
          sortOrder: 1,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        },
      ]);

      const linkId = newLinkId();
      await db.insert(systemStructureEntityLinks).values({
        id: linkId,
        systemId,
        entityId: childEntityId,
        parentEntityId,
        sortOrder: 0,
        createdAt: now,
      });

      const rows = await db
        .select()
        .from(systemStructureEntityLinks)
        .where(eq(systemStructureEntityLinks.id, linkId));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.parentEntityId).toBe(parentEntityId);
      expect(rows[0]?.entityId).toBe(childEntityId);
    });

    it("rejects nonexistent parentEntityId FK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const typeId = newTypeId();
      const entityId = newEntityId();
      const now = fixtureNow();

      await db.insert(systemStructureEntityTypes).values({
        id: typeId,
        systemId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(systemStructureEntities).values({
        id: entityId,
        systemId,
        entityTypeId: typeId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        db.insert(systemStructureEntityLinks).values({
          id: newLinkId(),
          systemId,
          entityId,
          parentEntityId: brandId<SystemStructureEntityId>("nonexistent"),
          sortOrder: 0,
          createdAt: now,
        }),
      ).rejects.toThrow();
    });

    it("restricts deletion of parent entity with dependent link", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const typeId = newTypeId();
      const parentEntityId = newEntityId();
      const childEntityId = newEntityId();
      const now = fixtureNow();

      await db.insert(systemStructureEntityTypes).values({
        id: typeId,
        systemId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(systemStructureEntities).values([
        {
          id: parentEntityId,
          systemId,
          entityTypeId: typeId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        },
        {
          id: childEntityId,
          systemId,
          entityTypeId: typeId,
          sortOrder: 1,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        },
      ]);
      await db.insert(systemStructureEntityLinks).values({
        id: newLinkId(),
        systemId,
        entityId: childEntityId,
        parentEntityId,
        sortOrder: 0,
        createdAt: now,
      });

      await expect(
        db.delete(systemStructureEntities).where(eq(systemStructureEntities.id, parentEntityId)),
      ).rejects.toThrow();
    });

    it("enforces unique (entityId, parentEntityId)", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const typeId = newTypeId();
      const parentEntityId = newEntityId();
      const childEntityId = newEntityId();
      const now = fixtureNow();

      await db.insert(systemStructureEntityTypes).values({
        id: typeId,
        systemId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(systemStructureEntities).values([
        {
          id: parentEntityId,
          systemId,
          entityTypeId: typeId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        },
        {
          id: childEntityId,
          systemId,
          entityTypeId: typeId,
          sortOrder: 1,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        },
      ]);

      await db.insert(systemStructureEntityLinks).values({
        id: newLinkId(),
        systemId,
        entityId: childEntityId,
        parentEntityId,
        sortOrder: 0,
        createdAt: now,
      });

      await expect(
        db.insert(systemStructureEntityLinks).values({
          id: newLinkId(),
          systemId,
          entityId: childEntityId,
          parentEntityId,
          sortOrder: 1,
          createdAt: now,
        }),
      ).rejects.toThrow();
    });

    it("enforces unique entityId at root (parentEntityId = null)", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const typeId = newTypeId();
      const entityId = newEntityId();
      const now = fixtureNow();

      await db.insert(systemStructureEntityTypes).values({
        id: typeId,
        systemId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(systemStructureEntities).values({
        id: entityId,
        systemId,
        entityTypeId: typeId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(systemStructureEntityLinks).values({
        id: newLinkId(),
        systemId,
        entityId,
        sortOrder: 0,
        createdAt: now,
      });

      await expect(
        db.insert(systemStructureEntityLinks).values({
          id: newLinkId(),
          systemId,
          entityId,
          sortOrder: 1,
          createdAt: now,
        }),
      ).rejects.toThrow();
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const typeId = newTypeId();
      const entityId = newEntityId();
      const linkId = newLinkId();
      const now = fixtureNow();

      await db.insert(systemStructureEntityTypes).values({
        id: typeId,
        systemId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(systemStructureEntities).values({
        id: entityId,
        systemId,
        entityTypeId: typeId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(systemStructureEntityLinks).values({
        id: linkId,
        systemId,
        entityId,
        sortOrder: 0,
        createdAt: now,
      });

      await client.query("DELETE FROM systems WHERE id = $1", [systemId]);
      const result = await client.query(
        "SELECT * FROM system_structure_entity_links WHERE id = $1",
        [linkId],
      );
      expect(result.rows).toHaveLength(0);
    });
  });
});
