/**
 * SQLite custom fields schema — field_values table (core tests).
 *
 * Covers: field_values basic lifecycle, FK constraints, memberId uniqueness = 9 tests.
 *
 * Source: schema-sqlite-custom-fields.integration.test.ts (lines 340-642)
 */

import { brandId } from "@pluralscape/types";
import Database from "better-sqlite3-multiple-ciphers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/sqlite/auth.js";
import { fieldDefinitions, fieldValues } from "../schema/sqlite/custom-fields.js";
import { systems } from "../schema/sqlite/systems.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import {
  createSqliteCustomFieldsTables,
  sqliteInsertAccount,
  sqliteInsertMember,
  sqliteInsertSystem,
  testBlob,
} from "./helpers/sqlite-helpers.js";

import type { FieldDefinitionId, FieldValueId, MemberId, SystemId } from "@pluralscape/types";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = { accounts, systems, fieldDefinitions, fieldValues };

describe("SQLite custom fields schema — field_values (core)", () => {
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
    db.delete(fieldValues).run();
    db.delete(fieldDefinitions).run();
  });

  describe("field_values", () => {
    it("inserts with encrypted_data and round-trips binary", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const fieldDefId = insertFieldDefinition(systemId);
      const id = brandId<FieldValueId>(crypto.randomUUID());
      const now = fixtureNow();
      const data = testBlob(new Uint8Array([10, 20, 30, 40, 50]));

      db.insert(fieldValues)
        .values({
          id,
          fieldDefinitionId: fieldDefId,
          systemId,
          encryptedData: data,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(fieldValues).where(eq(fieldValues.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.fieldDefinitionId).toBe(fieldDefId);
      expect(rows[0]?.systemId).toBe(systemId);
    });

    it("defaults version to 1", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const fieldDefId = insertFieldDefinition(systemId);
      const id = brandId<FieldValueId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(fieldValues)
        .values({
          id,
          fieldDefinitionId: fieldDefId,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(fieldValues).where(eq(fieldValues.id, id)).all();
      expect(rows[0]?.version).toBe(1);
    });

    it("restricts field definition deletion when referenced by field value", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const fieldDefId = insertFieldDefinition(systemId);
      const now = fixtureNow();

      db.insert(fieldValues)
        .values({
          id: brandId<FieldValueId>(crypto.randomUUID()),
          fieldDefinitionId: fieldDefId,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      expect(() =>
        db.delete(fieldDefinitions).where(eq(fieldDefinitions.id, fieldDefId)).run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const fieldDefId = insertFieldDefinition(systemId);
      const id = brandId<FieldValueId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(fieldValues)
        .values({
          id,
          fieldDefinitionId: fieldDefId,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.delete(systems).where(eq(systems.id, systemId)).run();
      const rows = db.select().from(fieldValues).where(eq(fieldValues.id, id)).all();
      expect(rows).toHaveLength(0);
    });

    it("rejects nonexistent fieldDefinitionId FK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = fixtureNow();

      expect(() =>
        db
          .insert(fieldValues)
          .values({
            id: brandId<FieldValueId>(crypto.randomUUID()),
            fieldDefinitionId: brandId<FieldDefinitionId>("nonexistent"),
            systemId,
            encryptedData: testBlob(new Uint8Array([1])),
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("round-trips memberId T3 column", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = brandId<MemberId>(sqliteInsertMember(db, systemId));
      const fieldDefId = insertFieldDefinition(systemId);
      const id = brandId<FieldValueId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(fieldValues)
        .values({
          id,
          fieldDefinitionId: fieldDefId,
          systemId,
          memberId,
          encryptedData: testBlob(new Uint8Array([1, 2, 3])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(fieldValues).where(eq(fieldValues.id, id)).all();
      expect(rows[0]?.memberId).toBe(memberId);
    });

    it("allows same fieldDefinitionId for different members", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId1 = brandId<MemberId>(sqliteInsertMember(db, systemId));
      const memberId2 = brandId<MemberId>(sqliteInsertMember(db, systemId));
      const fieldDefId = insertFieldDefinition(systemId);
      const now = fixtureNow();

      db.insert(fieldValues)
        .values({
          id: brandId<FieldValueId>(crypto.randomUUID()),
          fieldDefinitionId: fieldDefId,
          systemId,
          memberId: memberId1,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();
      db.insert(fieldValues)
        .values({
          id: brandId<FieldValueId>(crypto.randomUUID()),
          fieldDefinitionId: fieldDefId,
          systemId,
          memberId: memberId2,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db
        .select()
        .from(fieldValues)
        .where(eq(fieldValues.fieldDefinitionId, fieldDefId))
        .all();
      expect(rows).toHaveLength(2);
    });

    it("rejects duplicate (fieldDefinitionId, memberId)", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = brandId<MemberId>(sqliteInsertMember(db, systemId));
      const fieldDefId = insertFieldDefinition(systemId);
      const now = fixtureNow();

      db.insert(fieldValues)
        .values({
          id: brandId<FieldValueId>(crypto.randomUUID()),
          fieldDefinitionId: fieldDefId,
          systemId,
          memberId,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      expect(() =>
        db
          .insert(fieldValues)
          .values({
            id: brandId<FieldValueId>(crypto.randomUUID()),
            fieldDefinitionId: fieldDefId,
            systemId,
            memberId,
            encryptedData: testBlob(),
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow(/UNIQUE|constraint/i);
    });

    it("rejects duplicate system-level value where memberId IS NULL", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const fieldDefId = insertFieldDefinition(systemId);
      const now = fixtureNow();

      db.insert(fieldValues)
        .values({
          id: brandId<FieldValueId>(crypto.randomUUID()),
          fieldDefinitionId: fieldDefId,
          systemId,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      expect(() =>
        db
          .insert(fieldValues)
          .values({
            id: brandId<FieldValueId>(crypto.randomUUID()),
            fieldDefinitionId: fieldDefId,
            systemId,
            encryptedData: testBlob(),
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow(/UNIQUE|constraint/i);
    });

    it("allows member-level and system-level values for same fieldDefinitionId", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = brandId<MemberId>(sqliteInsertMember(db, systemId));
      const fieldDefId = insertFieldDefinition(systemId);
      const now = fixtureNow();

      db.insert(fieldValues)
        .values({
          id: brandId<FieldValueId>(crypto.randomUUID()),
          fieldDefinitionId: fieldDefId,
          systemId,
          memberId,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();
      db.insert(fieldValues)
        .values({
          id: brandId<FieldValueId>(crypto.randomUUID()),
          fieldDefinitionId: fieldDefId,
          systemId,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db
        .select()
        .from(fieldValues)
        .where(eq(fieldValues.fieldDefinitionId, fieldDefId))
        .all();
      expect(rows).toHaveLength(2);
    });

    it("defaults memberId to null", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const fieldDefId = insertFieldDefinition(systemId);
      const id = brandId<FieldValueId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(fieldValues)
        .values({
          id,
          fieldDefinitionId: fieldDefId,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(fieldValues).where(eq(fieldValues.id, id)).all();
      expect(rows[0]?.memberId).toBeNull();
    });
  });
});
