import { brandId } from "@pluralscape/types";
import { and, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  fieldBucketVisibility,
  fieldDefinitions,
  fieldValues,
} from "../schema/pg/custom-fields.js";
import { buckets } from "../schema/pg/privacy.js";
import { systems } from "../schema/pg/systems.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import {
  clearCustomFieldsTables,
  insertAccount as insertAccountWith,
  insertBucket as insertBucketWith,
  insertFieldDefinition as insertFieldDefinitionWith,
  insertSystem as insertSystemWith,
  setupCustomFieldsFixture,
  teardownCustomFieldsFixture,
  type CustomFieldsDb,
} from "./helpers/custom-fields-fixtures.js";
import { pgInsertMember, testBlob } from "./helpers/pg-helpers.js";

import type { PGlite } from "@electric-sql/pglite";
import type {
  BucketId,
  FieldDefinitionId,
  FieldValueId,
  MemberId,
  SystemId,
} from "@pluralscape/types";

describe("PG custom fields schema — values and bucket visibility", () => {
  let client: PGlite;
  let db: CustomFieldsDb;

  const insertAccount = (id?: string) => insertAccountWith(db, id);
  const insertSystem = (accountId: string, id?: string) => insertSystemWith(db, accountId, id);
  const insertBucket = (systemId: SystemId, id?: BucketId): Promise<BucketId> =>
    insertBucketWith(db, systemId, id);
  const insertFieldDefinition = (
    systemId: SystemId,
    id?: FieldDefinitionId,
  ): Promise<FieldDefinitionId> => insertFieldDefinitionWith(db, systemId, id);

  beforeAll(async () => {
    const fixture = await setupCustomFieldsFixture();
    client = fixture.client;
    db = fixture.db;
  });

  afterAll(async () => {
    await teardownCustomFieldsFixture({ client, db });
  });

  afterEach(async () => {
    await clearCustomFieldsTables(db);
  });

  describe("field_values", () => {
    it("inserts with encrypted_data and round-trips binary", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const fieldDefId = await insertFieldDefinition(systemId);
      const id = brandId<FieldValueId>(crypto.randomUUID());
      const now = fixtureNow();
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
      const id = brandId<FieldValueId>(crypto.randomUUID());
      const now = fixtureNow();

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

    it("restricts field definition deletion when referenced by field value", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const fieldDefId = await insertFieldDefinition(systemId);
      const valueId = brandId<FieldValueId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(fieldValues).values({
        id: valueId,
        fieldDefinitionId: fieldDefId,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        db.delete(fieldDefinitions).where(eq(fieldDefinitions.id, fieldDefId)),
      ).rejects.toThrow();
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const fieldDefId = await insertFieldDefinition(systemId);
      const valueId = brandId<FieldValueId>(crypto.randomUUID());
      const now = fixtureNow();

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
      const now = fixtureNow();

      await expect(
        db.insert(fieldValues).values({
          id: brandId<FieldValueId>(crypto.randomUUID()),
          fieldDefinitionId: brandId<FieldDefinitionId>("nonexistent"),
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
      const memberId = brandId<MemberId>(await pgInsertMember(db, systemId));
      const fieldDefId = await insertFieldDefinition(systemId);
      const id = brandId<FieldValueId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(fieldValues).values({
        id,
        fieldDefinitionId: fieldDefId,
        systemId,
        memberId,
        encryptedData: testBlob(new Uint8Array([1, 2, 3])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(fieldValues).where(eq(fieldValues.id, id));
      expect(rows[0]?.memberId).toBe(memberId);
    });

    it("allows same fieldDefinitionId for different members", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId1 = brandId<MemberId>(await pgInsertMember(db, systemId));
      const memberId2 = brandId<MemberId>(await pgInsertMember(db, systemId));
      const fieldDefId = await insertFieldDefinition(systemId);
      const now = fixtureNow();

      await db.insert(fieldValues).values({
        id: brandId<FieldValueId>(crypto.randomUUID()),
        fieldDefinitionId: fieldDefId,
        systemId,
        memberId: memberId1,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(fieldValues).values({
        id: brandId<FieldValueId>(crypto.randomUUID()),
        fieldDefinitionId: fieldDefId,
        systemId,
        memberId: memberId2,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db
        .select()
        .from(fieldValues)
        .where(eq(fieldValues.fieldDefinitionId, fieldDefId));
      expect(rows).toHaveLength(2);
    });

    it("rejects duplicate (fieldDefinitionId, memberId)", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = brandId<MemberId>(await pgInsertMember(db, systemId));
      const fieldDefId = await insertFieldDefinition(systemId);
      const now = fixtureNow();

      await db.insert(fieldValues).values({
        id: brandId<FieldValueId>(crypto.randomUUID()),
        fieldDefinitionId: fieldDefId,
        systemId,
        memberId,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        db.insert(fieldValues).values({
          id: brandId<FieldValueId>(crypto.randomUUID()),
          fieldDefinitionId: fieldDefId,
          systemId,
          memberId,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("rejects duplicate system-level value where memberId IS NULL", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const fieldDefId = await insertFieldDefinition(systemId);
      const now = fixtureNow();

      await db.insert(fieldValues).values({
        id: brandId<FieldValueId>(crypto.randomUUID()),
        fieldDefinitionId: fieldDefId,
        systemId,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        db.insert(fieldValues).values({
          id: brandId<FieldValueId>(crypto.randomUUID()),
          fieldDefinitionId: fieldDefId,
          systemId,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("allows member-level and system-level values for same fieldDefinitionId", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = brandId<MemberId>(await pgInsertMember(db, systemId));
      const fieldDefId = await insertFieldDefinition(systemId);
      const now = fixtureNow();

      await db.insert(fieldValues).values({
        id: brandId<FieldValueId>(crypto.randomUUID()),
        fieldDefinitionId: fieldDefId,
        systemId,
        memberId,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(fieldValues).values({
        id: brandId<FieldValueId>(crypto.randomUUID()),
        fieldDefinitionId: fieldDefId,
        systemId,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db
        .select()
        .from(fieldValues)
        .where(eq(fieldValues.fieldDefinitionId, fieldDefId));
      expect(rows).toHaveLength(2);
    });

    it("defaults memberId to null", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const fieldDefId = await insertFieldDefinition(systemId);
      const id = brandId<FieldValueId>(crypto.randomUUID());
      const now = fixtureNow();

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
        systemId,
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

    it("restricts field definition deletion when referenced by visibility", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const fieldDefId = await insertFieldDefinition(systemId);
      const bucketId = await insertBucket(systemId);

      await db.insert(fieldBucketVisibility).values({
        fieldDefinitionId: fieldDefId,
        bucketId,
        systemId,
      });

      await expect(
        db.delete(fieldDefinitions).where(eq(fieldDefinitions.id, fieldDefId)),
      ).rejects.toThrow();
    });

    it("restricts bucket deletion when referenced by visibility", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const fieldDefId = await insertFieldDefinition(systemId);
      const bucketId = await insertBucket(systemId);

      await db.insert(fieldBucketVisibility).values({
        fieldDefinitionId: fieldDefId,
        bucketId,
        systemId,
      });

      await expect(db.delete(buckets).where(eq(buckets.id, bucketId))).rejects.toThrow();
    });

    it("rejects duplicate composite primary key", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const fieldDefId = await insertFieldDefinition(systemId);
      const bucketId = await insertBucket(systemId);

      await db.insert(fieldBucketVisibility).values({
        fieldDefinitionId: fieldDefId,
        bucketId,
        systemId,
      });

      await expect(
        db.insert(fieldBucketVisibility).values({
          fieldDefinitionId: fieldDefId,
          bucketId,
          systemId,
        }),
      ).rejects.toThrow();
    });

    it("rejects nonexistent fieldDefinitionId FK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const bucketId = await insertBucket(systemId);

      await expect(
        db.insert(fieldBucketVisibility).values({
          fieldDefinitionId: brandId<FieldDefinitionId>("nonexistent"),
          bucketId,
          systemId,
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
          bucketId: brandId<BucketId>("nonexistent"),
          systemId,
        }),
      ).rejects.toThrow();
    });

    it("queries multiple visibility records by bucket_id", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const bucketId = await insertBucket(systemId);
      const fieldDefId1 = await insertFieldDefinition(systemId);
      const fieldDefId2 = await insertFieldDefinition(systemId);

      await db.insert(fieldBucketVisibility).values([
        { fieldDefinitionId: fieldDefId1, bucketId, systemId },
        { fieldDefinitionId: fieldDefId2, bucketId, systemId },
      ]);

      const rows = await db
        .select()
        .from(fieldBucketVisibility)
        .where(eq(fieldBucketVisibility.bucketId, bucketId));
      expect(rows).toHaveLength(2);
      expect(rows.map((r) => r.fieldDefinitionId).sort()).toEqual(
        [fieldDefId1, fieldDefId2].sort(),
      );
    });
  });
});
