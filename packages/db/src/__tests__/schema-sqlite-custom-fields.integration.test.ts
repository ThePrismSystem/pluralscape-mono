import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/sqlite/auth.js";
import {
  fieldBucketVisibility,
  fieldDefinitions,
  fieldValues,
} from "../schema/sqlite/custom-fields.js";
import { buckets } from "../schema/sqlite/privacy.js";
import { systems } from "../schema/sqlite/systems.js";

import {
  createSqliteCustomFieldsTables,
  sqliteInsertAccount,
  sqliteInsertSystem,
} from "./helpers/sqlite-helpers.js";

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = {
  accounts,
  systems,
  buckets,
  fieldDefinitions,
  fieldValues,
  fieldBucketVisibility,
};

describe("SQLite custom fields schema", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  const insertAccount = (id?: string): string => sqliteInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string): string =>
    sqliteInsertSystem(db, accountId, id);

  function insertBucket(systemId: string, id = crypto.randomUUID()): string {
    const now = Date.now();
    db.insert(buckets)
      .values({
        id,
        systemId,
        encryptedData: new Uint8Array([1, 2, 3]),
        createdAt: now,
        updatedAt: now,
      })
      .run();
    return id;
  }

  function insertFieldDefinition(systemId: string, id = crypto.randomUUID()): string {
    const now = Date.now();
    db.insert(fieldDefinitions)
      .values({
        id,
        systemId,
        encryptedData: new Uint8Array([1, 2, 3]),
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

  describe("field_definitions", () => {
    it("inserts with encrypted_data and round-trips binary", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = new Uint8Array([10, 20, 30, 40, 50]);

      db.insert(fieldDefinitions)
        .values({
          id,
          systemId,
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
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(fieldDefinitions)
        .values({
          id,
          systemId,
          encryptedData: new Uint8Array([1]),
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
      const now = Date.now();
      expect(() =>
        db
          .insert(fieldDefinitions)
          .values({
            id: crypto.randomUUID(),
            systemId: "nonexistent",
            encryptedData: new Uint8Array([1]),
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("round-trips archived: true with archivedAt timestamp", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(fieldDefinitions)
        .values({
          id,
          systemId,
          encryptedData: new Uint8Array([1]),
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
  });

  describe("field_values", () => {
    it("inserts with encrypted_data and round-trips binary", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const fieldDefId = insertFieldDefinition(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = new Uint8Array([10, 20, 30, 40, 50]);

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
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(fieldValues)
        .values({
          id,
          fieldDefinitionId: fieldDefId,
          systemId,
          encryptedData: new Uint8Array([1]),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(fieldValues).where(eq(fieldValues.id, id)).all();
      expect(rows[0]?.version).toBe(1);
    });

    it("cascades on field definition deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const fieldDefId = insertFieldDefinition(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(fieldValues)
        .values({
          id,
          fieldDefinitionId: fieldDefId,
          systemId,
          encryptedData: new Uint8Array([1]),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.delete(fieldDefinitions).where(eq(fieldDefinitions.id, fieldDefId)).run();
      const rows = db.select().from(fieldValues).where(eq(fieldValues.id, id)).all();
      expect(rows).toHaveLength(0);
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const fieldDefId = insertFieldDefinition(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(fieldValues)
        .values({
          id,
          fieldDefinitionId: fieldDefId,
          systemId,
          encryptedData: new Uint8Array([1]),
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
      const now = Date.now();

      expect(() =>
        db
          .insert(fieldValues)
          .values({
            id: crypto.randomUUID(),
            fieldDefinitionId: "nonexistent",
            systemId,
            encryptedData: new Uint8Array([1]),
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });
  });

  describe("field_bucket_visibility", () => {
    it("inserts and queries a visibility record", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const fieldDefId = insertFieldDefinition(systemId);
      const bucketId = insertBucket(systemId);

      db.insert(fieldBucketVisibility)
        .values({
          fieldDefinitionId: fieldDefId,
          bucketId,
        })
        .run();

      const rows = db
        .select()
        .from(fieldBucketVisibility)
        .where(eq(fieldBucketVisibility.fieldDefinitionId, fieldDefId))
        .all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.bucketId).toBe(bucketId);
    });

    it("cascades on field definition deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const fieldDefId = insertFieldDefinition(systemId);
      const bucketId = insertBucket(systemId);

      db.insert(fieldBucketVisibility)
        .values({
          fieldDefinitionId: fieldDefId,
          bucketId,
        })
        .run();

      db.delete(fieldDefinitions).where(eq(fieldDefinitions.id, fieldDefId)).run();
      const rows = db
        .select()
        .from(fieldBucketVisibility)
        .where(eq(fieldBucketVisibility.fieldDefinitionId, fieldDefId))
        .all();
      expect(rows).toHaveLength(0);
    });

    it("cascades on bucket deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const fieldDefId = insertFieldDefinition(systemId);
      const bucketId = insertBucket(systemId);

      db.insert(fieldBucketVisibility)
        .values({
          fieldDefinitionId: fieldDefId,
          bucketId,
        })
        .run();

      db.delete(buckets).where(eq(buckets.id, bucketId)).run();
      const rows = db
        .select()
        .from(fieldBucketVisibility)
        .where(eq(fieldBucketVisibility.bucketId, bucketId))
        .all();
      expect(rows).toHaveLength(0);
    });

    it("composite PK prevents duplicate entries", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const fieldDefId = insertFieldDefinition(systemId);
      const bucketId = insertBucket(systemId);

      db.insert(fieldBucketVisibility)
        .values({
          fieldDefinitionId: fieldDefId,
          bucketId,
        })
        .run();

      expect(() =>
        db
          .insert(fieldBucketVisibility)
          .values({
            fieldDefinitionId: fieldDefId,
            bucketId,
          })
          .run(),
      ).toThrow(/UNIQUE|PRIMARY KEY|constraint/i);
    });

    it("rejects nonexistent fieldDefinitionId FK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const bucketId = insertBucket(systemId);

      expect(() =>
        db
          .insert(fieldBucketVisibility)
          .values({
            fieldDefinitionId: "nonexistent",
            bucketId,
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("rejects nonexistent bucketId FK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const fieldDefId = insertFieldDefinition(systemId);

      expect(() =>
        db
          .insert(fieldBucketVisibility)
          .values({
            fieldDefinitionId: fieldDefId,
            bucketId: "nonexistent",
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });
  });
});
