/**
 * SQLite structure schema — systemStructureEntityTypes and systemStructureEntities tables.
 *
 * Covers: systemStructureEntityTypes (8 tests), systemStructureEntities (7 tests) = 15 tests.
 *
 * Source: schema-sqlite-structure.integration.test.ts (lines 448-867)
 */

import { brandId } from "@pluralscape/types";
import Database from "better-sqlite3-multiple-ciphers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/sqlite/auth.js";
import { systemStructureEntities, systemStructureEntityTypes } from "../schema/sqlite/structure.js";
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
  SystemStructureEntityTypeId,
} from "@pluralscape/types";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const newTypeId = (): SystemStructureEntityTypeId =>
  brandId<SystemStructureEntityTypeId>(crypto.randomUUID());
const newEntityId = (): SystemStructureEntityId =>
  brandId<SystemStructureEntityId>(crypto.randomUUID());

const schema = { accounts, systems, systemStructureEntityTypes, systemStructureEntities };

describe("SQLite structure schema — entity types and entities", () => {
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
    db.delete(systemStructureEntities).run();
    db.delete(systemStructureEntityTypes).run();
  });

  describe("systemStructureEntityTypes", () => {
    it("inserts and round-trips encrypted data", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = newTypeId();
      const now = fixtureNow();
      const data = testBlob(new Uint8Array([10, 20]));

      db.insert(systemStructureEntityTypes)
        .values({ id, systemId, sortOrder: 0, encryptedData: data, createdAt: now, updatedAt: now })
        .run();

      const rows = db
        .select()
        .from(systemStructureEntityTypes)
        .where(eq(systemStructureEntityTypes.id, id))
        .all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
    });

    it("defaults version to 1", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = newTypeId();
      const now = fixtureNow();

      db.insert(systemStructureEntityTypes)
        .values({
          id,
          systemId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db
        .select()
        .from(systemStructureEntityTypes)
        .where(eq(systemStructureEntityTypes.id, id))
        .all();
      expect(rows[0]?.version).toBe(1);
    });

    it("rejects nonexistent systemId FK", () => {
      const now = fixtureNow();
      expect(() =>
        db
          .insert(systemStructureEntityTypes)
          .values({
            id: newTypeId(),
            systemId: brandId<SystemId>("nonexistent"),
            sortOrder: 0,
            encryptedData: testBlob(),
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("defaults archived to false", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = newTypeId();
      const now = fixtureNow();

      db.insert(systemStructureEntityTypes)
        .values({
          id,
          systemId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db
        .select()
        .from(systemStructureEntityTypes)
        .where(eq(systemStructureEntityTypes.id, id))
        .all();
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = newTypeId();
      const now = fixtureNow();

      db.insert(systemStructureEntityTypes)
        .values({
          id,
          systemId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.delete(systems).where(eq(systems.id, systemId)).run();
      const rows = db
        .select()
        .from(systemStructureEntityTypes)
        .where(eq(systemStructureEntityTypes.id, id))
        .all();
      expect(rows).toHaveLength(0);
    });

    it("rejects archived=true with null archivedAt", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = fixtureNow();

      expect(() =>
        client
          .prepare(
            `INSERT INTO system_structure_entity_types (id, system_id, sort_order, encrypted_data, created_at, updated_at, archived, archived_at)
             VALUES (?, ?, 0, X'0102', ?, ?, 1, NULL)`,
          )
          .run(crypto.randomUUID(), systemId, now, now),
      ).toThrow(/check|constraint/i);
    });

    it("rejects archived=false with non-null archivedAt", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = fixtureNow();

      expect(() =>
        client
          .prepare(
            `INSERT INTO system_structure_entity_types (id, system_id, sort_order, encrypted_data, created_at, updated_at, archived, archived_at)
             VALUES (?, ?, 0, X'0102', ?, ?, 0, ?)`,
          )
          .run(crypto.randomUUID(), systemId, now, now, now),
      ).toThrow(/check|constraint/i);
    });

    it("rejects version 0", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = fixtureNow();

      expect(() =>
        client
          .prepare(
            `INSERT INTO system_structure_entity_types (id, system_id, sort_order, encrypted_data, created_at, updated_at, version)
             VALUES (?, ?, 0, X'0102', ?, ?, 0)`,
          )
          .run(crypto.randomUUID(), systemId, now, now),
      ).toThrow(/check|constraint/i);
    });
  });

  // ── systemStructureEntities ────────────────────────────────────────

  describe("systemStructureEntities", () => {
    it("inserts and round-trips data", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const typeId = newTypeId();
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

      const entityId = newEntityId();
      const data = testBlob(new Uint8Array([30, 40]));
      db.insert(systemStructureEntities)
        .values({
          id: entityId,
          systemId,
          entityTypeId: typeId,
          sortOrder: 0,
          encryptedData: data,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db
        .select()
        .from(systemStructureEntities)
        .where(eq(systemStructureEntities.id, entityId))
        .all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.entityTypeId).toBe(typeId);
    });

    it("rejects nonexistent entityTypeId FK (RESTRICT)", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = fixtureNow();

      expect(() =>
        db
          .insert(systemStructureEntities)
          .values({
            id: newEntityId(),
            systemId,
            entityTypeId: brandId<SystemStructureEntityTypeId>("nonexistent"),
            sortOrder: 0,
            encryptedData: testBlob(),
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("prevents deletion of entity type with dependent entities (RESTRICT)", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const typeId = newTypeId();
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
          id: newEntityId(),
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
          .delete(systemStructureEntityTypes)
          .where(eq(systemStructureEntityTypes.id, typeId))
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("defaults version to 1", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const typeId = newTypeId();
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

      const entityId = newEntityId();
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

      const rows = db
        .select()
        .from(systemStructureEntities)
        .where(eq(systemStructureEntities.id, entityId))
        .all();
      expect(rows[0]?.version).toBe(1);
    });

    it("rejects archived=true with null archivedAt", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const typeId = newTypeId();
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

      expect(() =>
        client
          .prepare(
            `INSERT INTO system_structure_entities (id, system_id, entity_type_id, sort_order, encrypted_data, created_at, updated_at, archived, archived_at)
             VALUES (?, ?, ?, 0, X'0102', ?, ?, 1, NULL)`,
          )
          .run(crypto.randomUUID(), systemId, typeId, now, now),
      ).toThrow(/check|constraint/i);
    });

    it("rejects archived=false with non-null archivedAt", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const typeId = newTypeId();
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

      expect(() =>
        client
          .prepare(
            `INSERT INTO system_structure_entities (id, system_id, entity_type_id, sort_order, encrypted_data, created_at, updated_at, archived, archived_at)
             VALUES (?, ?, ?, 0, X'0102', ?, ?, 0, ?)`,
          )
          .run(crypto.randomUUID(), systemId, typeId, now, now, now),
      ).toThrow(/check|constraint/i);
    });

    it("cascades on system deletion", () => {
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

      db.delete(systems).where(eq(systems.id, systemId)).run();
      const rows = db
        .select()
        .from(systemStructureEntities)
        .where(eq(systemStructureEntities.id, entityId))
        .all();
      expect(rows).toHaveLength(0);
    });
  });
});
