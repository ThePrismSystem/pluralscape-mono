import { PGlite } from "@electric-sql/pglite";
import { brandId } from "@pluralscape/types";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/pg/auth.js";
import {
  fieldBucketVisibility,
  fieldDefinitionScopes,
  fieldDefinitions,
  fieldValues,
} from "../schema/pg/custom-fields.js";
import { groups } from "../schema/pg/groups.js";
import { buckets } from "../schema/pg/privacy.js";
import { systemStructureEntities, systemStructureEntityTypes } from "../schema/pg/structure.js";
import { systems } from "../schema/pg/systems.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import {
  createPgCustomFieldsTables,
  pgInsertAccount,
  pgInsertMember,
  pgInsertSystem,
  testBlob,
} from "./helpers/pg-helpers.js";

import type {
  BucketId,
  FieldDefinitionId,
  FieldDefinitionScopeId,
  FieldValueId,
  GroupId,
  MemberId,
  SystemId,
  SystemStructureEntityId,
  SystemStructureEntityTypeId,
} from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const schema = {
  accounts,
  systems,
  buckets,
  groups,
  systemStructureEntityTypes,
  systemStructureEntities,
  fieldDefinitions,
  fieldDefinitionScopes,
  fieldValues,
  fieldBucketVisibility,
};

describe("PG custom fields schema", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;

  const insertAccount = (id?: string) => pgInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string) => pgInsertSystem(db, accountId, id);

  async function insertBucket(
    systemId: SystemId,
    id: BucketId = brandId<BucketId>(crypto.randomUUID()),
  ): Promise<BucketId> {
    const now = fixtureNow();
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
    systemId: SystemId,
    id: FieldDefinitionId = brandId<FieldDefinitionId>(crypto.randomUUID()),
  ): Promise<FieldDefinitionId> {
    const now = fixtureNow();
    await db.insert(fieldDefinitions).values({
      id,
      systemId,
      fieldType: "text",
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

  afterEach(async () => {
    await db.delete(fieldBucketVisibility);
    await db.delete(fieldValues);
    await db.delete(fieldDefinitions);
  });

  describe("field_definitions", () => {
    it("inserts with encrypted_data and round-trips binary", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<FieldDefinitionId>(crypto.randomUUID());
      const now = fixtureNow();
      const data = testBlob(new Uint8Array([10, 20, 30, 40, 50]));

      await db.insert(fieldDefinitions).values({
        id,
        systemId,
        fieldType: "text",
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
      const id = brandId<FieldDefinitionId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(fieldDefinitions).values({
        id,
        systemId,
        fieldType: "text",
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
      const now = fixtureNow();
      await expect(
        db.insert(fieldDefinitions).values({
          id: brandId<FieldDefinitionId>(crypto.randomUUID()),
          systemId: brandId<SystemId>("nonexistent"),
          fieldType: "text",
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("round-trips archived: true with archivedAt timestamp", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<FieldDefinitionId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(fieldDefinitions).values({
        id,
        systemId,
        fieldType: "text",
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

    it("updates archived from false to true", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<FieldDefinitionId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(fieldDefinitions).values({
        id,
        systemId,
        fieldType: "text",
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const archiveTime = fixtureNow();
      await db
        .update(fieldDefinitions)
        .set({ archived: true, archivedAt: archiveTime })
        .where(eq(fieldDefinitions.id, id));

      const rows = await db.select().from(fieldDefinitions).where(eq(fieldDefinitions.id, id));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(archiveTime);
    });

    it("round-trips T3 metadata columns", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<FieldDefinitionId>(crypto.randomUUID());
      const now = fixtureNow();

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

    it("defaults T3 metadata to default values", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<FieldDefinitionId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(fieldDefinitions).values({
        id,
        systemId,
        fieldType: "text",
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(fieldDefinitions).where(eq(fieldDefinitions.id, id));
      expect(rows[0]?.fieldType).toBe("text");
      expect(rows[0]?.required).toBe(false);
      expect(rows[0]?.sortOrder).toBe(0);
    });

    it("rejects invalid fieldType via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = fixtureNow();

      await expect(
        db.insert(fieldDefinitions).values({
          id: brandId<FieldDefinitionId>(crypto.randomUUID()),
          systemId,
          fieldType: "invalid" as "text",
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow(/check|constraint|failed query/i);
    });

    it("rejects archived=true with archivedAt=null via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = fixtureNow();

      await expect(
        client.query(
          "INSERT INTO field_definitions (id, system_id, field_type, required, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES ($1, $2, 'text', false, '\\x0102'::bytea, $3, $4, 1, true, NULL)",
          [crypto.randomUUID(), systemId, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });

    it("rejects archived=false with archivedAt set via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = fixtureNow();

      await expect(
        client.query(
          "INSERT INTO field_definitions (id, system_id, field_type, required, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES ($1, $2, 'text', false, '\\x0102'::bytea, $3, $4, 1, false, $5)",
          [crypto.randomUUID(), systemId, now, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });
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

  describe("field_definition_scopes", () => {
    afterEach(async () => {
      await db.delete(fieldDefinitionScopes);
    });

    async function insertEntityType(
      systemId: SystemId,
      id = brandId<SystemStructureEntityTypeId>(crypto.randomUUID()),
    ): Promise<SystemStructureEntityTypeId> {
      const now = fixtureNow();
      await db.insert(systemStructureEntityTypes).values({
        id,
        systemId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });
      return id;
    }

    it("inserts and round-trips a member scope", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const fieldDefId = await insertFieldDefinition(systemId);
      const id = brandId<FieldDefinitionScopeId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(fieldDefinitionScopes).values({
        id,
        fieldDefinitionId: fieldDefId,
        scopeType: "member",
        systemId,
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db
        .select()
        .from(fieldDefinitionScopes)
        .where(eq(fieldDefinitionScopes.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.fieldDefinitionId).toBe(fieldDefId);
      expect(rows[0]?.scopeType).toBe("member");
      expect(rows[0]?.scopeEntityTypeId).toBeNull();
      expect(rows[0]?.version).toBe(1);
    });

    it("rejects nonexistent field_definition_id FK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = fixtureNow();

      await expect(
        db.insert(fieldDefinitionScopes).values({
          id: brandId<FieldDefinitionScopeId>(crypto.randomUUID()),
          fieldDefinitionId: brandId<FieldDefinitionId>("nonexistent"),
          scopeType: "member",
          systemId,
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("rejects nonexistent scope_entity_type_id FK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const fieldDefId = await insertFieldDefinition(systemId);
      const now = fixtureNow();

      await expect(
        db.insert(fieldDefinitionScopes).values({
          id: brandId<FieldDefinitionScopeId>(crypto.randomUUID()),
          fieldDefinitionId: fieldDefId,
          scopeType: "structure-entity-type",
          scopeEntityTypeId: brandId<SystemStructureEntityTypeId>("nonexistent"),
          systemId,
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("rejects invalid scope_type via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const fieldDefId = await insertFieldDefinition(systemId);
      const now = fixtureNow();

      await expect(
        client.query(
          "INSERT INTO field_definition_scopes (id, field_definition_id, scope_type, system_id, created_at, updated_at, version) VALUES ($1, $2, 'invalid-scope', $3, $4, $5, 1)",
          [crypto.randomUUID(), fieldDefId, systemId, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });

    it("rejects non-null scope_entity_type_id with scope_type != structure-entity-type", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const fieldDefId = await insertFieldDefinition(systemId);
      const entityTypeId = brandId<SystemStructureEntityTypeId>(await insertEntityType(systemId));
      const now = fixtureNow();

      await expect(
        client.query(
          "INSERT INTO field_definition_scopes (id, field_definition_id, scope_type, scope_entity_type_id, system_id, created_at, updated_at, version) VALUES ($1, $2, 'member', $3, $4, $5, $6, 1)",
          [crypto.randomUUID(), fieldDefId, entityTypeId, systemId, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });

    it("rejects duplicate (field_definition_id, scope_type, NULL scope_entity_type_id)", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const fieldDefId = await insertFieldDefinition(systemId);
      const now = fixtureNow();

      await db.insert(fieldDefinitionScopes).values({
        id: brandId<FieldDefinitionScopeId>(crypto.randomUUID()),
        fieldDefinitionId: fieldDefId,
        scopeType: "member",
        systemId,
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        db.insert(fieldDefinitionScopes).values({
          id: brandId<FieldDefinitionScopeId>(crypto.randomUUID()),
          fieldDefinitionId: fieldDefId,
          scopeType: "member",
          systemId,
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("rejects version 0 via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const fieldDefId = await insertFieldDefinition(systemId);
      const now = fixtureNow();

      await expect(
        client.query(
          "INSERT INTO field_definition_scopes (id, field_definition_id, scope_type, system_id, created_at, updated_at, version) VALUES ($1, $2, 'member', $3, $4, $5, 0)",
          [crypto.randomUUID(), fieldDefId, systemId, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const fieldDefId = await insertFieldDefinition(systemId);
      const id = brandId<FieldDefinitionScopeId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(fieldDefinitionScopes).values({
        id,
        fieldDefinitionId: fieldDefId,
        scopeType: "member",
        systemId,
        createdAt: now,
        updatedAt: now,
      });

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db
        .select()
        .from(fieldDefinitionScopes)
        .where(eq(fieldDefinitionScopes.id, id));
      expect(rows).toHaveLength(0);
    });

    it("restricts deletion of field definition with dependent scopes", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const fieldDefId = await insertFieldDefinition(systemId);
      const now = fixtureNow();

      await db.insert(fieldDefinitionScopes).values({
        id: brandId<FieldDefinitionScopeId>(crypto.randomUUID()),
        fieldDefinitionId: fieldDefId,
        scopeType: "member",
        systemId,
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        client.query("DELETE FROM field_definitions WHERE id = $1", [fieldDefId]),
      ).rejects.toThrow();
    });
  });

  describe("field_values — structureEntityId and groupId columns", () => {
    async function insertEntityType(
      systemId: SystemId,
      id = brandId<SystemStructureEntityTypeId>(crypto.randomUUID()),
    ): Promise<SystemStructureEntityTypeId> {
      const now = fixtureNow();
      await db.insert(systemStructureEntityTypes).values({
        id,
        systemId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });
      return id;
    }

    async function insertEntity(
      systemId: SystemId,
      entityTypeId: SystemStructureEntityTypeId,
      id = brandId<SystemStructureEntityId>(crypto.randomUUID()),
    ): Promise<SystemStructureEntityId> {
      const now = fixtureNow();
      await db.insert(systemStructureEntities).values({
        id,
        systemId,
        entityTypeId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });
      return id;
    }

    async function insertGroup(systemId: string, raw = crypto.randomUUID()): Promise<GroupId> {
      const id = brandId<GroupId>(raw);
      const now = fixtureNow();
      await db.insert(groups).values({
        id,
        systemId: brandId<SystemId>(systemId),
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });
      return id;
    }

    it("field value with structureEntityId only succeeds", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const fieldDefId = await insertFieldDefinition(systemId);
      const entityTypeId = brandId<SystemStructureEntityTypeId>(await insertEntityType(systemId));
      const entityId = brandId<SystemStructureEntityId>(await insertEntity(systemId, entityTypeId));
      const id = brandId<FieldValueId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(fieldValues).values({
        id,
        fieldDefinitionId: fieldDefId,
        structureEntityId: entityId,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(fieldValues).where(eq(fieldValues.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.structureEntityId).toBe(entityId);
      expect(rows[0]?.memberId).toBeNull();
      expect(rows[0]?.groupId).toBeNull();
    });

    it("field value with groupId only succeeds", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const fieldDefId = await insertFieldDefinition(systemId);
      const groupId = brandId<GroupId>(await insertGroup(systemId));
      const id = brandId<FieldValueId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(fieldValues).values({
        id,
        fieldDefinitionId: fieldDefId,
        groupId,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(fieldValues).where(eq(fieldValues.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.groupId).toBe(groupId);
      expect(rows[0]?.memberId).toBeNull();
      expect(rows[0]?.structureEntityId).toBeNull();
    });

    it("rejects memberId + structureEntityId both set via subject_exclusivity_check", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const fieldDefId = await insertFieldDefinition(systemId);
      const memberId = brandId<MemberId>(await pgInsertMember(db, systemId));
      const entityTypeId = brandId<SystemStructureEntityTypeId>(await insertEntityType(systemId));
      const entityId = brandId<SystemStructureEntityId>(await insertEntity(systemId, entityTypeId));
      const now = fixtureNow();

      await expect(
        db.insert(fieldValues).values({
          id: brandId<FieldValueId>(crypto.randomUUID()),
          fieldDefinitionId: fieldDefId,
          memberId,
          structureEntityId: entityId,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("rejects memberId + groupId both set via subject_exclusivity_check", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const fieldDefId = await insertFieldDefinition(systemId);
      const memberId = brandId<MemberId>(await pgInsertMember(db, systemId));
      const groupId = brandId<GroupId>(await insertGroup(systemId));
      const now = fixtureNow();

      await expect(
        db.insert(fieldValues).values({
          id: brandId<FieldValueId>(crypto.randomUUID()),
          fieldDefinitionId: fieldDefId,
          memberId,
          groupId,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("rejects structureEntityId + groupId both set via subject_exclusivity_check", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const fieldDefId = await insertFieldDefinition(systemId);
      const entityTypeId = brandId<SystemStructureEntityTypeId>(await insertEntityType(systemId));
      const entityId = brandId<SystemStructureEntityId>(await insertEntity(systemId, entityTypeId));
      const groupId = brandId<GroupId>(await insertGroup(systemId));
      const now = fixtureNow();

      await expect(
        db.insert(fieldValues).values({
          id: brandId<FieldValueId>(crypto.randomUUID()),
          fieldDefinitionId: fieldDefId,
          structureEntityId: entityId,
          groupId,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("rejects all three subject columns set via subject_exclusivity_check", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const fieldDefId = await insertFieldDefinition(systemId);
      const memberId = brandId<MemberId>(await pgInsertMember(db, systemId));
      const entityTypeId = brandId<SystemStructureEntityTypeId>(await insertEntityType(systemId));
      const entityId = brandId<SystemStructureEntityId>(await insertEntity(systemId, entityTypeId));
      const groupId = brandId<GroupId>(await insertGroup(systemId));
      const now = fixtureNow();

      await expect(
        db.insert(fieldValues).values({
          id: brandId<FieldValueId>(crypto.randomUUID()),
          fieldDefinitionId: fieldDefId,
          memberId,
          structureEntityId: entityId,
          groupId,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("restricts deletion of structure entity with dependent field values", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const fieldDefId = await insertFieldDefinition(systemId);
      const entityTypeId = brandId<SystemStructureEntityTypeId>(await insertEntityType(systemId));
      const entityId = brandId<SystemStructureEntityId>(await insertEntity(systemId, entityTypeId));
      const now = fixtureNow();

      await db.insert(fieldValues).values({
        id: brandId<FieldValueId>(crypto.randomUUID()),
        fieldDefinitionId: fieldDefId,
        structureEntityId: entityId,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        client.query("DELETE FROM system_structure_entities WHERE id = $1", [entityId]),
      ).rejects.toThrow();
    });

    it("restricts deletion of group with dependent field values", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const fieldDefId = await insertFieldDefinition(systemId);
      const groupId = brandId<GroupId>(await insertGroup(systemId));
      const now = fixtureNow();

      await db.insert(fieldValues).values({
        id: brandId<FieldValueId>(crypto.randomUUID()),
        fieldDefinitionId: fieldDefId,
        groupId,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await expect(client.query("DELETE FROM groups WHERE id = $1", [groupId])).rejects.toThrow();
    });

    it("rejects nonexistent structureEntityId FK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const fieldDefId = await insertFieldDefinition(systemId);
      const now = fixtureNow();

      await expect(
        db.insert(fieldValues).values({
          id: brandId<FieldValueId>(crypto.randomUUID()),
          fieldDefinitionId: fieldDefId,
          structureEntityId: brandId<SystemStructureEntityId>("nonexistent"),
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("rejects nonexistent groupId FK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const fieldDefId = await insertFieldDefinition(systemId);
      const now = fixtureNow();

      await expect(
        db.insert(fieldValues).values({
          id: brandId<FieldValueId>(crypto.randomUUID()),
          fieldDefinitionId: fieldDefId,
          groupId: brandId<GroupId>("nonexistent"),
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("rejects duplicate (fieldDefinitionId, structureEntityId) via definition_entity_uniq", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const fieldDefId = await insertFieldDefinition(systemId);
      const entityTypeId = brandId<SystemStructureEntityTypeId>(await insertEntityType(systemId));
      const entityId = brandId<SystemStructureEntityId>(await insertEntity(systemId, entityTypeId));
      const now = fixtureNow();

      await db.insert(fieldValues).values({
        id: brandId<FieldValueId>(crypto.randomUUID()),
        fieldDefinitionId: fieldDefId,
        structureEntityId: entityId,
        systemId,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        db.insert(fieldValues).values({
          id: brandId<FieldValueId>(crypto.randomUUID()),
          fieldDefinitionId: fieldDefId,
          structureEntityId: entityId,
          systemId,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("rejects duplicate (fieldDefinitionId, groupId) via definition_group_uniq", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const fieldDefId = await insertFieldDefinition(systemId);
      const groupId = brandId<GroupId>(await insertGroup(systemId));
      const now = fixtureNow();

      await db.insert(fieldValues).values({
        id: brandId<FieldValueId>(crypto.randomUUID()),
        fieldDefinitionId: fieldDefId,
        groupId,
        systemId,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        db.insert(fieldValues).values({
          id: brandId<FieldValueId>(crypto.randomUUID()),
          fieldDefinitionId: fieldDefId,
          groupId,
          systemId,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });
  });
});
