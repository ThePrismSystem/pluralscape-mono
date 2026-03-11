import { PGlite } from "@electric-sql/pglite";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/pg/auth.js";
import {
  fieldBucketVisibility,
  fieldDefinitions,
  fieldValues,
} from "../schema/pg/custom-fields.js";
import { buckets } from "../schema/pg/privacy.js";
import { systems } from "../schema/pg/systems.js";

import {
  createPgCustomFieldsTables,
  pgInsertAccount,
  pgInsertSystem,
  testBlob,
} from "./helpers/pg-helpers.js";

import type { PgliteDatabase } from "drizzle-orm/pglite";

const schema = {
  accounts,
  systems,
  buckets,
  fieldDefinitions,
  fieldValues,
  fieldBucketVisibility,
};

describe("PG custom fields schema", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;

  const insertAccount = (id?: string) => pgInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string) => pgInsertSystem(db, accountId, id);

  async function insertBucket(systemId: string, id = crypto.randomUUID()): Promise<string> {
    const now = Date.now();
    await db.insert(buckets).values({
      id,
      systemId,
      encryptedData: testBlob(),
      createdAt: now,
      updatedAt: now,
    });
    return id;
  }

  async function insertFieldDefinition(
    systemId: string,
    id = crypto.randomUUID(),
  ): Promise<string> {
    const now = Date.now();
    await db.insert(fieldDefinitions).values({
      id,
      systemId,
      encryptedData: testBlob(),
      createdAt: now,
      updatedAt: now,
    });
    return id;
  }

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgCustomFieldsTables(client);
  });

  afterAll(async () => {
    await client.close();
  });

  describe("field_definitions", () => {
    it("inserts with encrypted_data and round-trips binary", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = testBlob(new Uint8Array([10, 20, 30, 40, 50]));

      await db.insert(fieldDefinitions).values({
        id,
        systemId,
        encryptedData: data,
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(fieldDefinitions).where(eq(fieldDefinitions.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.systemId).toBe(systemId);
    });

    it("defaults version to 1, archived to false, and archivedAt to null", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(fieldDefinitions).values({
        id,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(fieldDefinitions).where(eq(fieldDefinitions.id, id));
      expect(rows[0]?.version).toBe(1);
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const fieldDefId = await insertFieldDefinition(systemId);

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db
        .select()
        .from(fieldDefinitions)
        .where(eq(fieldDefinitions.id, fieldDefId));
      expect(rows).toHaveLength(0);
    });

    it("rejects nonexistent systemId FK", async () => {
      const now = Date.now();
      await expect(
        db.insert(fieldDefinitions).values({
          id: crypto.randomUUID(),
          systemId: "nonexistent",
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("round-trips archived: true with archivedAt timestamp", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(fieldDefinitions).values({
        id,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
        archived: true,
        archivedAt: now,
      });

      const rows = await db.select().from(fieldDefinitions).where(eq(fieldDefinitions.id, id));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("round-trips T3 metadata columns", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(fieldDefinitions).values({
        id,
        systemId,
        fieldType: "text",
        required: true,
        sortOrder: 5,
        encryptedData: testBlob(new Uint8Array([1, 2, 3])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(fieldDefinitions).where(eq(fieldDefinitions.id, id));
      expect(rows[0]?.fieldType).toBe("text");
      expect(rows[0]?.required).toBe(true);
      expect(rows[0]?.sortOrder).toBe(5);
    });

    it("defaults T3 metadata to null", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(fieldDefinitions).values({
        id,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(fieldDefinitions).where(eq(fieldDefinitions.id, id));
      expect(rows[0]?.fieldType).toBeNull();
      expect(rows[0]?.required).toBeNull();
      expect(rows[0]?.sortOrder).toBeNull();
    });

    it("rejects invalid fieldType via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await expect(
        db.insert(fieldDefinitions).values({
          id: crypto.randomUUID(),
          systemId,
          fieldType: "invalid" as "text",
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow(/check|constraint|failed query/i);
    });
  });

  describe("field_values", () => {
    it("inserts with encrypted_data and round-trips binary", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const fieldDefId = await insertFieldDefinition(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = testBlob(new Uint8Array([10, 20, 30, 40, 50]));

      await db.insert(fieldValues).values({
        id,
        fieldDefinitionId: fieldDefId,
        systemId,
        encryptedData: data,
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(fieldValues).where(eq(fieldValues.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.fieldDefinitionId).toBe(fieldDefId);
      expect(rows[0]?.systemId).toBe(systemId);
    });

    it("defaults version to 1", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const fieldDefId = await insertFieldDefinition(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(fieldValues).values({
        id,
        fieldDefinitionId: fieldDefId,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(fieldValues).where(eq(fieldValues.id, id));
      expect(rows[0]?.version).toBe(1);
    });

    it("cascades on field definition deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const fieldDefId = await insertFieldDefinition(systemId);
      const valueId = crypto.randomUUID();
      const now = Date.now();

      await db.insert(fieldValues).values({
        id: valueId,
        fieldDefinitionId: fieldDefId,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await db.delete(fieldDefinitions).where(eq(fieldDefinitions.id, fieldDefId));
      const rows = await db.select().from(fieldValues).where(eq(fieldValues.id, valueId));
      expect(rows).toHaveLength(0);
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const fieldDefId = await insertFieldDefinition(systemId);
      const valueId = crypto.randomUUID();
      const now = Date.now();

      await db.insert(fieldValues).values({
        id: valueId,
        fieldDefinitionId: fieldDefId,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db.select().from(fieldValues).where(eq(fieldValues.id, valueId));
      expect(rows).toHaveLength(0);
    });

    it("rejects nonexistent fieldDefinitionId FK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await expect(
        db.insert(fieldValues).values({
          id: crypto.randomUUID(),
          fieldDefinitionId: "nonexistent",
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("round-trips memberId T3 column", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const fieldDefId = await insertFieldDefinition(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(fieldValues).values({
        id,
        fieldDefinitionId: fieldDefId,
        systemId,
        memberId: "member-1",
        encryptedData: testBlob(new Uint8Array([1, 2, 3])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(fieldValues).where(eq(fieldValues.id, id));
      expect(rows[0]?.memberId).toBe("member-1");
    });

    it("defaults memberId to null", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const fieldDefId = await insertFieldDefinition(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(fieldValues).values({
        id,
        fieldDefinitionId: fieldDefId,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(fieldValues).where(eq(fieldValues.id, id));
      expect(rows[0]?.memberId).toBeNull();
    });
  });

  describe("field_bucket_visibility", () => {
    it("inserts and queries by composite key", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const fieldDefId = await insertFieldDefinition(systemId);
      const bucketId = await insertBucket(systemId);

      await db.insert(fieldBucketVisibility).values({
        fieldDefinitionId: fieldDefId,
        bucketId,
      });

      const rows = await db
        .select()
        .from(fieldBucketVisibility)
        .where(
          and(
            eq(fieldBucketVisibility.fieldDefinitionId, fieldDefId),
            eq(fieldBucketVisibility.bucketId, bucketId),
          ),
        );
      expect(rows).toHaveLength(1);
      expect(rows[0]?.fieldDefinitionId).toBe(fieldDefId);
      expect(rows[0]?.bucketId).toBe(bucketId);
    });

    it("cascades on field definition deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const fieldDefId = await insertFieldDefinition(systemId);
      const bucketId = await insertBucket(systemId);

      await db.insert(fieldBucketVisibility).values({
        fieldDefinitionId: fieldDefId,
        bucketId,
      });

      await db.delete(fieldDefinitions).where(eq(fieldDefinitions.id, fieldDefId));
      const rows = await db
        .select()
        .from(fieldBucketVisibility)
        .where(eq(fieldBucketVisibility.fieldDefinitionId, fieldDefId));
      expect(rows).toHaveLength(0);
    });

    it("cascades on bucket deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const fieldDefId = await insertFieldDefinition(systemId);
      const bucketId = await insertBucket(systemId);

      await db.insert(fieldBucketVisibility).values({
        fieldDefinitionId: fieldDefId,
        bucketId,
      });

      await db.delete(buckets).where(eq(buckets.id, bucketId));
      const rows = await db
        .select()
        .from(fieldBucketVisibility)
        .where(eq(fieldBucketVisibility.bucketId, bucketId));
      expect(rows).toHaveLength(0);
    });

    it("rejects duplicate composite primary key", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const fieldDefId = await insertFieldDefinition(systemId);
      const bucketId = await insertBucket(systemId);

      await db.insert(fieldBucketVisibility).values({
        fieldDefinitionId: fieldDefId,
        bucketId,
      });

      await expect(
        db.insert(fieldBucketVisibility).values({
          fieldDefinitionId: fieldDefId,
          bucketId,
        }),
      ).rejects.toThrow();
    });

    it("rejects nonexistent fieldDefinitionId FK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const bucketId = await insertBucket(systemId);

      await expect(
        db.insert(fieldBucketVisibility).values({
          fieldDefinitionId: "nonexistent",
          bucketId,
        }),
      ).rejects.toThrow();
    });

    it("rejects nonexistent bucketId FK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const fieldDefId = await insertFieldDefinition(systemId);

      await expect(
        db.insert(fieldBucketVisibility).values({
          fieldDefinitionId: fieldDefId,
          bucketId: "nonexistent",
        }),
      ).rejects.toThrow();
    });
  });
});
