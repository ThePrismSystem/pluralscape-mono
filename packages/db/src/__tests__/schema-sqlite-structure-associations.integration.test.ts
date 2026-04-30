/**
 * SQLite structure schema — systemStructureEntityAssociations table.
 *
 * Covers: systemStructureEntityAssociations (5 tests).
 *
 * Source: schema-sqlite-structure.integration.test.ts (lines 1515-1795)
 */

import { brandId } from "@pluralscape/types";
import Database from "better-sqlite3-multiple-ciphers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/sqlite/auth.js";
import {
  systemStructureEntities,
  systemStructureEntityAssociations,
  systemStructureEntityTypes,
} from "../schema/sqlite/structure.js";
import { systems } from "../schema/sqlite/systems.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import {
  createSqliteStructureTables,
  sqliteInsertAccount,
  sqliteInsertSystem,
  testBlob,
} from "./helpers/sqlite-helpers.js";

import type {
  SystemId,
  SystemStructureEntityAssociationId,
  SystemStructureEntityId,
  SystemStructureEntityTypeId,
} from "@pluralscape/types";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const newTypeId = (): SystemStructureEntityTypeId =>
  brandId<SystemStructureEntityTypeId>(crypto.randomUUID());
const newEntityId = (): SystemStructureEntityId =>
  brandId<SystemStructureEntityId>(crypto.randomUUID());
const newAssocId = (): SystemStructureEntityAssociationId =>
  brandId<SystemStructureEntityAssociationId>(crypto.randomUUID());

const schema = {
  accounts,
  systems,
  systemStructureEntityTypes,
  systemStructureEntities,
  systemStructureEntityAssociations,
};

describe("SQLite structure schema — systemStructureEntityAssociations", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  const insertAccount = (id?: string) => sqliteInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string): SystemId =>
    sqliteInsertSystem(db, accountId, id);

  beforeAll(() => {
    client = new Database(":memory:");
    client.pragma("foreign_keys = ON");
    db = drizzle(client, { schema });
    createSqliteStructureTables(client);
  });

  afterAll(() => {
    client.close();
  });

  afterEach(() => {
    db.delete(systemStructureEntityAssociations).run();
    db.delete(systemStructureEntities).run();
    db.delete(systemStructureEntityTypes).run();
  });

  describe("systemStructureEntityAssociations", () => {
    it("inserts and round-trips data", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const typeId = newTypeId();
      const entityId1 = newEntityId();
      const entityId2 = newEntityId();
      const now = fixtureNow();

      db.insert(systemStructureEntityTypes)
        .values({
          id: typeId,
          systemId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();
      db.insert(systemStructureEntities)
        .values([
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
        ])
        .run();

      const assocId = newAssocId();
      db.insert(systemStructureEntityAssociations)
        .values({
          id: assocId,
          systemId,
          sourceEntityId: entityId1,
          targetEntityId: entityId2,
          createdAt: now,
        })
        .run();

      const rows = db
        .select()
        .from(systemStructureEntityAssociations)
        .where(eq(systemStructureEntityAssociations.id, assocId))
        .all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.sourceEntityId).toBe(entityId1);
      expect(rows[0]?.targetEntityId).toBe(entityId2);
    });

    it("enforces unique (sourceEntityId, targetEntityId)", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const typeId = newTypeId();
      const entityId1 = newEntityId();
      const entityId2 = newEntityId();
      const now = fixtureNow();

      db.insert(systemStructureEntityTypes)
        .values({
          id: typeId,
          systemId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();
      db.insert(systemStructureEntities)
        .values([
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
        ])
        .run();

      db.insert(systemStructureEntityAssociations)
        .values({
          id: newAssocId(),
          systemId,
          sourceEntityId: entityId1,
          targetEntityId: entityId2,
          createdAt: now,
        })
        .run();

      expect(() =>
        db
          .insert(systemStructureEntityAssociations)
          .values({
            id: newAssocId(),
            systemId,
            sourceEntityId: entityId1,
            targetEntityId: entityId2,
            createdAt: now,
          })
          .run(),
      ).toThrow(/UNIQUE|constraint/i);
    });

    it("prevents deletion of entity with dependent associations (RESTRICT)", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const typeId = newTypeId();
      const entityId1 = newEntityId();
      const entityId2 = newEntityId();
      const now = fixtureNow();

      db.insert(systemStructureEntityTypes)
        .values({
          id: typeId,
          systemId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();
      db.insert(systemStructureEntities)
        .values([
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
        ])
        .run();
      db.insert(systemStructureEntityAssociations)
        .values({
          id: newAssocId(),
          systemId,
          sourceEntityId: entityId1,
          targetEntityId: entityId2,
          createdAt: now,
        })
        .run();

      expect(() =>
        db.delete(systemStructureEntities).where(eq(systemStructureEntities.id, entityId1)).run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const typeId = newTypeId();
      const entityId1 = newEntityId();
      const entityId2 = newEntityId();
      const assocId = newAssocId();
      const now = fixtureNow();

      db.insert(systemStructureEntityTypes)
        .values({
          id: typeId,
          systemId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();
      db.insert(systemStructureEntities)
        .values([
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
        ])
        .run();
      db.insert(systemStructureEntityAssociations)
        .values({
          id: assocId,
          systemId,
          sourceEntityId: entityId1,
          targetEntityId: entityId2,
          createdAt: now,
        })
        .run();

      client.prepare("DELETE FROM systems WHERE id = ?").run(systemId);
      const rows = client
        .prepare("SELECT * FROM system_structure_entity_associations WHERE id = ?")
        .all(assocId);
      expect(rows).toHaveLength(0);
    });

    it("rejects self-referential association", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const typeId = newTypeId();
      const entityId = newEntityId();
      const now = fixtureNow();

      db.insert(systemStructureEntityTypes)
        .values({
          id: typeId,
          systemId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();
      db.insert(systemStructureEntities)
        .values({
          id: entityId,
          systemId,
          entityTypeId: typeId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      expect(() =>
        client
          .prepare(
            `INSERT INTO system_structure_entity_associations (id, system_id, source_entity_id, target_entity_id, created_at)
             VALUES (?, ?, ?, ?, ?)`,
          )
          .run(crypto.randomUUID(), systemId, entityId, entityId, now),
      ).toThrow(/check|constraint/i);
    });
  });
});
