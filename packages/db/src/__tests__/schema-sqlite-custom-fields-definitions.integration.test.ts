/**
 * SQLite custom fields schema — field_definitions table.
 *
 * Covers: field_definitions (11 tests).
 *
 * Source: schema-sqlite-custom-fields.integration.test.ts (lines 113-338)
 */

import { brandId } from "@pluralscape/types";
import Database from "better-sqlite3-multiple-ciphers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/sqlite/auth.js";
import { fieldDefinitions } from "../schema/sqlite/custom-fields.js";
import { systems } from "../schema/sqlite/systems.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import {
  createSqliteCustomFieldsTables,
  sqliteInsertAccount,
  sqliteInsertSystem,
  testBlob,
} from "./helpers/sqlite-helpers.js";

import type { FieldDefinitionId, SystemId } from "@pluralscape/types";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = { accounts, systems, fieldDefinitions };

describe("SQLite custom fields schema — field_definitions", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  const insertAccount = (id?: string) => sqliteInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string) => sqliteInsertSystem(db, accountId, id);

  function insertFieldDefinition(
    systemId: SystemId,
    id: FieldDefinitionId = brandId<FieldDefinitionId>(crypto.randomUUID()),
  ): FieldDefinitionId {
    const now = fixtureNow();
    db.insert(fieldDefinitions)
      .values({
        id,
        systemId,
        fieldType: "text",
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      })
      .run();
    return id;
  }

  beforeAll(() => {
    client = new Database(":memory:");
    client.pragma("foreign_keys = ON");
    db = drizzle(client, { schema });
    createSqliteCustomFieldsTables(client);
  });

  afterAll(() => {
    client.close();
  });

  afterEach(() => {
    db.delete(fieldDefinitions).run();
  });

  describe("field_definitions", () => {
    it("inserts with encrypted_data and round-trips binary", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = brandId<FieldDefinitionId>(crypto.randomUUID());
      const now = fixtureNow();
      const data = testBlob(new Uint8Array([10, 20, 30, 40, 50]));

      db.insert(fieldDefinitions)
        .values({
          id,
          systemId,
          fieldType: "text",
          encryptedData: data,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(fieldDefinitions).where(eq(fieldDefinitions.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.systemId).toBe(systemId);
    });

    it("defaults version to 1, archived to false, and archivedAt to null", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = brandId<FieldDefinitionId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(fieldDefinitions)
        .values({
          id,
          systemId,
          fieldType: "text",
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(fieldDefinitions).where(eq(fieldDefinitions.id, id)).all();
      expect(rows[0]?.version).toBe(1);
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const fieldDefId = insertFieldDefinition(systemId);

      db.delete(systems).where(eq(systems.id, systemId)).run();
      const rows = db
        .select()
        .from(fieldDefinitions)
        .where(eq(fieldDefinitions.id, fieldDefId))
        .all();
      expect(rows).toHaveLength(0);
    });

    it("rejects nonexistent systemId FK", () => {
      const now = fixtureNow();
      expect(() =>
        db
          .insert(fieldDefinitions)
          .values({
            id: brandId<FieldDefinitionId>(crypto.randomUUID()),
            systemId: brandId<SystemId>("nonexistent"),
            fieldType: "text",
            encryptedData: testBlob(new Uint8Array([1])),
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("round-trips archived: true with archivedAt timestamp", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = brandId<FieldDefinitionId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(fieldDefinitions)
        .values({
          id,
          systemId,
          fieldType: "text",
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
          archived: true,
          archivedAt: now,
        })
        .run();

      const rows = db.select().from(fieldDefinitions).where(eq(fieldDefinitions.id, id)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("round-trips T3 metadata columns", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = brandId<FieldDefinitionId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(fieldDefinitions)
        .values({
          id,
          systemId,
          fieldType: "text",
          required: true,
          sortOrder: 5,
          encryptedData: testBlob(new Uint8Array([1, 2, 3])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(fieldDefinitions).where(eq(fieldDefinitions.id, id)).all();
      expect(rows[0]?.fieldType).toBe("text");
      expect(rows[0]?.required).toBe(true);
      expect(rows[0]?.sortOrder).toBe(5);
    });

    it("defaults T3 metadata to default values", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = brandId<FieldDefinitionId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(fieldDefinitions)
        .values({
          id,
          systemId,
          fieldType: "text",
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(fieldDefinitions).where(eq(fieldDefinitions.id, id)).all();
      expect(rows[0]?.fieldType).toBe("text");
      expect(rows[0]?.required).toBe(false);
      expect(rows[0]?.sortOrder).toBe(0);
    });

    it("rejects invalid fieldType via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = fixtureNow();

      expect(() =>
        db
          .insert(fieldDefinitions)
          .values({
            id: brandId<FieldDefinitionId>(crypto.randomUUID()),
            systemId,
            fieldType: "invalid" as "text",
            encryptedData: testBlob(new Uint8Array([1])),
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow(/CHECK|constraint/i);
    });

    it("rejects archived=true with archivedAt=null via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = fixtureNow();

      expect(() =>
        client
          .prepare(
            "INSERT INTO field_definitions (id, system_id, field_type, required, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES (?, ?, 'text', 0, X'0102', ?, ?, 1, 1, NULL)",
          )
          .run(crypto.randomUUID(), systemId, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("rejects archived=false with archivedAt set via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = fixtureNow();

      expect(() =>
        client
          .prepare(
            "INSERT INTO field_definitions (id, system_id, field_type, required, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES (?, ?, 'text', 0, X'0102', ?, ?, 1, 0, ?)",
          )
          .run(crypto.randomUUID(), systemId, now, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("updates archived from false to true", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = brandId<FieldDefinitionId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(fieldDefinitions)
        .values({
          id,
          systemId,
          fieldType: "text",
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.update(fieldDefinitions)
        .set({ archived: true, archivedAt: now })
        .where(eq(fieldDefinitions.id, id))
        .run();

      const rows = db.select().from(fieldDefinitions).where(eq(fieldDefinitions.id, id)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });
  });
});
