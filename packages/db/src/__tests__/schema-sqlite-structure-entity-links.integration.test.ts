/**
 * SQLite structure schema — systemStructureEntityLinks table.
 *
 * Covers: systemStructureEntityLinks (7 tests).
 *
 * Source: schema-sqlite-structure.integration.test.ts (lines 871-1284)
 */

import { brandId } from "@pluralscape/types";
import Database from "better-sqlite3-multiple-ciphers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/sqlite/auth.js";
import {
  systemStructureEntities,
  systemStructureEntityLinks,
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
  SystemStructureEntityId,
  SystemStructureEntityLinkId,
  SystemStructureEntityTypeId,
} from "@pluralscape/types";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const newTypeId = (): SystemStructureEntityTypeId =>
  brandId<SystemStructureEntityTypeId>(crypto.randomUUID());
const newEntityId = (): SystemStructureEntityId =>
  brandId<SystemStructureEntityId>(crypto.randomUUID());
const newLinkId = (): SystemStructureEntityLinkId =>
  brandId<SystemStructureEntityLinkId>(crypto.randomUUID());

const schema = {
  accounts,
  systems,
  systemStructureEntityTypes,
  systemStructureEntities,
  systemStructureEntityLinks,
};

describe("SQLite structure schema — systemStructureEntityLinks", () => {
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
    db.delete(systemStructureEntityLinks).run();
    db.delete(systemStructureEntities).run();
    db.delete(systemStructureEntityTypes).run();
  });

  describe("systemStructureEntityLinks", () => {
    it("inserts and round-trips data", () => {
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

      const linkId = newLinkId();
      db.insert(systemStructureEntityLinks)
        .values({ id: linkId, systemId, entityId, sortOrder: 0, createdAt: now })
        .run();

      const rows = db
        .select()
        .from(systemStructureEntityLinks)
        .where(eq(systemStructureEntityLinks.id, linkId))
        .all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.entityId).toBe(entityId);
      expect(rows[0]?.parentEntityId).toBeNull();
    });

    it("rejects nonexistent entityId FK (RESTRICT)", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = fixtureNow();

      expect(() =>
        db
          .insert(systemStructureEntityLinks)
          .values({
            id: newLinkId(),
            systemId,
            entityId: brandId<SystemStructureEntityId>("nonexistent"),
            sortOrder: 0,
            createdAt: now,
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("prevents deletion of entity with dependent links (RESTRICT)", () => {
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
      db.insert(systemStructureEntityLinks)
        .values({ id: newLinkId(), systemId, entityId, sortOrder: 0, createdAt: now })
        .run();

      expect(() =>
        db.delete(systemStructureEntities).where(eq(systemStructureEntities.id, entityId)).run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("round-trips parentEntityId", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const typeId = newTypeId();
      const parentEntityId = newEntityId();
      const childEntityId = newEntityId();
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
        ])
        .run();

      const linkId = newLinkId();
      db.insert(systemStructureEntityLinks)
        .values({
          id: linkId,
          systemId,
          entityId: childEntityId,
          parentEntityId,
          sortOrder: 0,
          createdAt: now,
        })
        .run();

      const rows = db
        .select()
        .from(systemStructureEntityLinks)
        .where(eq(systemStructureEntityLinks.id, linkId))
        .all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.parentEntityId).toBe(parentEntityId);
    });

    it("rejects nonexistent parentEntityId FK", () => {
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
        db
          .insert(systemStructureEntityLinks)
          .values({
            id: newLinkId(),
            systemId,
            entityId,
            parentEntityId: brandId<SystemStructureEntityId>("nonexistent"),
            sortOrder: 0,
            createdAt: now,
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("restricts deletion of parent entity with dependent link", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const typeId = newTypeId();
      const parentEntityId = newEntityId();
      const childEntityId = newEntityId();
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
        ])
        .run();
      db.insert(systemStructureEntityLinks)
        .values({
          id: newLinkId(),
          systemId,
          entityId: childEntityId,
          parentEntityId,
          sortOrder: 0,
          createdAt: now,
        })
        .run();

      expect(() =>
        db
          .delete(systemStructureEntities)
          .where(eq(systemStructureEntities.id, parentEntityId))
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("enforces unique (entityId, parentEntityId)", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const typeId = newTypeId();
      const parentEntityId = newEntityId();
      const childEntityId = newEntityId();
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
        ])
        .run();

      db.insert(systemStructureEntityLinks)
        .values({
          id: newLinkId(),
          systemId,
          entityId: childEntityId,
          parentEntityId,
          sortOrder: 0,
          createdAt: now,
        })
        .run();

      expect(() =>
        db
          .insert(systemStructureEntityLinks)
          .values({
            id: newLinkId(),
            systemId,
            entityId: childEntityId,
            parentEntityId,
            sortOrder: 1,
            createdAt: now,
          })
          .run(),
      ).toThrow(/UNIQUE|constraint/i);
    });

    it("enforces unique entityId at root (parentEntityId = null)", () => {
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

      db.insert(systemStructureEntityLinks)
        .values({ id: newLinkId(), systemId, entityId, sortOrder: 0, createdAt: now })
        .run();

      expect(() =>
        db
          .insert(systemStructureEntityLinks)
          .values({ id: newLinkId(), systemId, entityId, sortOrder: 1, createdAt: now })
          .run(),
      ).toThrow(/UNIQUE|constraint/i);
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const typeId = newTypeId();
      const entityId = newEntityId();
      const linkId = newLinkId();
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
      db.insert(systemStructureEntityLinks)
        .values({ id: linkId, systemId, entityId, sortOrder: 0, createdAt: now })
        .run();

      client.prepare("DELETE FROM systems WHERE id = ?").run(systemId);
      const rows = client
        .prepare("SELECT * FROM system_structure_entity_links WHERE id = ?")
        .all(linkId);
      expect(rows).toHaveLength(0);
    });
  });
});
