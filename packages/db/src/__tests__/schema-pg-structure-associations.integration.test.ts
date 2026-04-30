import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  systemStructureEntities,
  systemStructureEntityAssociations,
  systemStructureEntityTypes,
} from "../schema/pg/structure.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import { testBlob } from "./helpers/pg-helpers.js";
import {
  newAssocId,
  newEntityId,
  newTypeId,
  setupStructureFixture,
  teardownStructureFixture,
  clearStructureTables,
  insertAccount as insertAccountWith,
  insertSystem as insertSystemWith,
  type StructureDb,
} from "./helpers/structure-fixtures.js";

import type { PGlite } from "@electric-sql/pglite";

describe("PG structure schema — entity associations", () => {
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

  describe("systemStructureEntityAssociations", () => {
    it("inserts and round-trips data", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const typeId = newTypeId();
      const entityId1 = newEntityId();
      const entityId2 = newEntityId();
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
          id: entityId1,
          systemId,
          entityTypeId: typeId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        },
        {
          id: entityId2,
          systemId,
          entityTypeId: typeId,
          sortOrder: 1,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        },
      ]);

      const assocId = newAssocId();
      await db.insert(systemStructureEntityAssociations).values({
        id: assocId,
        systemId,
        sourceEntityId: entityId1,
        targetEntityId: entityId2,
        createdAt: now,
      });

      const rows = await db
        .select()
        .from(systemStructureEntityAssociations)
        .where(eq(systemStructureEntityAssociations.id, assocId));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.sourceEntityId).toBe(entityId1);
      expect(rows[0]?.targetEntityId).toBe(entityId2);
    });

    it("enforces unique (sourceEntityId, targetEntityId)", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const typeId = newTypeId();
      const entityId1 = newEntityId();
      const entityId2 = newEntityId();
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
          id: entityId1,
          systemId,
          entityTypeId: typeId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        },
        {
          id: entityId2,
          systemId,
          entityTypeId: typeId,
          sortOrder: 1,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        },
      ]);

      await db.insert(systemStructureEntityAssociations).values({
        id: newAssocId(),
        systemId,
        sourceEntityId: entityId1,
        targetEntityId: entityId2,
        createdAt: now,
      });

      await expect(
        db.insert(systemStructureEntityAssociations).values({
          id: newAssocId(),
          systemId,
          sourceEntityId: entityId1,
          targetEntityId: entityId2,
          createdAt: now,
        }),
      ).rejects.toThrow();
    });

    it("rejects self-referential association", async () => {
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
        client.query(
          "INSERT INTO system_structure_entity_associations (id, system_id, source_entity_id, target_entity_id, created_at) VALUES ($1, $2, $3, $3, $4)",
          [crypto.randomUUID(), systemId, entityId, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });

    it("prevents deletion of entity with dependent associations (RESTRICT)", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const typeId = newTypeId();
      const entityId1 = newEntityId();
      const entityId2 = newEntityId();
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
          id: entityId1,
          systemId,
          entityTypeId: typeId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        },
        {
          id: entityId2,
          systemId,
          entityTypeId: typeId,
          sortOrder: 1,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        },
      ]);
      await db.insert(systemStructureEntityAssociations).values({
        id: newAssocId(),
        systemId,
        sourceEntityId: entityId1,
        targetEntityId: entityId2,
        createdAt: now,
      });

      await expect(
        db.delete(systemStructureEntities).where(eq(systemStructureEntities.id, entityId1)),
      ).rejects.toThrow();
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const typeId = newTypeId();
      const entityId1 = newEntityId();
      const entityId2 = newEntityId();
      const assocId = newAssocId();
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
          id: entityId1,
          systemId,
          entityTypeId: typeId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        },
        {
          id: entityId2,
          systemId,
          entityTypeId: typeId,
          sortOrder: 1,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        },
      ]);
      await db.insert(systemStructureEntityAssociations).values({
        id: assocId,
        systemId,
        sourceEntityId: entityId1,
        targetEntityId: entityId2,
        createdAt: now,
      });

      await client.query("DELETE FROM systems WHERE id = $1", [systemId]);
      const result = await client.query(
        "SELECT * FROM system_structure_entity_associations WHERE id = $1",
        [assocId],
      );
      expect(result.rows).toHaveLength(0);
    });
  });
});
