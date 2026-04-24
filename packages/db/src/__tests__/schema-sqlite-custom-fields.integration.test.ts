import { brandId } from "@pluralscape/types";
import Database from "better-sqlite3-multiple-ciphers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/sqlite/auth.js";
import {
  fieldBucketVisibility,
  fieldDefinitionScopes,
  fieldDefinitions,
  fieldValues,
} from "../schema/sqlite/custom-fields.js";
import { groups } from "../schema/sqlite/groups.js";
import { buckets } from "../schema/sqlite/privacy.js";
import { systemStructureEntities, systemStructureEntityTypes } from "../schema/sqlite/structure.js";
import { systems } from "../schema/sqlite/systems.js";

import {
  createSqliteCustomFieldsTables,
  sqliteInsertAccount,
  sqliteInsertMember,
  sqliteInsertSystem,
  testBlob,
} from "./helpers/sqlite-helpers.js";

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
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

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

describe("SQLite custom fields schema", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  const insertAccount = (id?: string) => sqliteInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string) => sqliteInsertSystem(db, accountId, id);

  function insertBucket(
    systemId: SystemId,
    id: BucketId = brandId<BucketId>(crypto.randomUUID()),
  ): BucketId {
    const now = Date.now();
    db.insert(buckets)
      .values({
        id,
        systemId,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      })
      .run();
    return id;
  }

  function insertFieldDefinition(
    systemId: SystemId,
    id: FieldDefinitionId = brandId<FieldDefinitionId>(crypto.randomUUID()),
  ): FieldDefinitionId {
    const now = Date.now();
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
    db.delete(fieldBucketVisibility).run();
    db.delete(fieldValues).run();
    db.delete(fieldDefinitions).run();
  });

  describe("field_definitions", () => {
    it("inserts with encrypted_data and round-trips binary", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = brandId<FieldDefinitionId>(crypto.randomUUID());
      const now = Date.now();
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
      const now = Date.now();

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
      const now = Date.now();
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
      const now = Date.now();

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
      const now = Date.now();

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
      const now = Date.now();

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
      const now = Date.now();

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
      const now = Date.now();

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
      const now = Date.now();

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
      const now = Date.now();

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

  describe("field_values", () => {
    it("inserts with encrypted_data and round-trips binary", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const fieldDefId = insertFieldDefinition(systemId);
      const id = brandId<FieldValueId>(crypto.randomUUID());
      const now = Date.now();
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
      const now = Date.now();

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
      const now = Date.now();

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
      const now = Date.now();

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
      const now = Date.now();

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
      const now = Date.now();

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
      const now = Date.now();

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
      const now = Date.now();

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
      const now = Date.now();

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
      const now = Date.now();

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
      const now = Date.now();

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
          systemId,
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

    it("restricts field definition deletion when referenced by visibility", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const fieldDefId = insertFieldDefinition(systemId);
      const bucketId = insertBucket(systemId);

      db.insert(fieldBucketVisibility)
        .values({ fieldDefinitionId: fieldDefId, bucketId, systemId })
        .run();

      expect(() =>
        db.delete(fieldDefinitions).where(eq(fieldDefinitions.id, fieldDefId)).run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("restricts bucket deletion when referenced by visibility", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const fieldDefId = insertFieldDefinition(systemId);
      const bucketId = insertBucket(systemId);

      db.insert(fieldBucketVisibility)
        .values({ fieldDefinitionId: fieldDefId, bucketId, systemId })
        .run();

      expect(() => db.delete(buckets).where(eq(buckets.id, bucketId)).run()).toThrow(
        /FOREIGN KEY|constraint/i,
      );
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
          systemId,
        })
        .run();

      expect(() =>
        db
          .insert(fieldBucketVisibility)
          .values({
            fieldDefinitionId: fieldDefId,
            bucketId,
            systemId,
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
            fieldDefinitionId: brandId<FieldDefinitionId>("nonexistent"),
            bucketId,
            systemId,
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
            bucketId: brandId<BucketId>("nonexistent"),
            systemId,
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("queries multiple visibility records by bucket_id", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const bucketId = insertBucket(systemId);
      const fieldDefId1 = insertFieldDefinition(systemId);
      const fieldDefId2 = insertFieldDefinition(systemId);

      db.insert(fieldBucketVisibility)
        .values([
          { fieldDefinitionId: fieldDefId1, bucketId, systemId },
          { fieldDefinitionId: fieldDefId2, bucketId, systemId },
        ])
        .run();

      const rows = db
        .select()
        .from(fieldBucketVisibility)
        .where(eq(fieldBucketVisibility.bucketId, bucketId))
        .all();
      expect(rows).toHaveLength(2);
      expect(rows.map((r) => r.fieldDefinitionId).sort()).toEqual(
        [fieldDefId1, fieldDefId2].sort(),
      );
    });
  });

  describe("field_definition_scopes", () => {
    afterEach(() => {
      db.delete(fieldDefinitionScopes).run();
    });

    function insertEntityType(systemId: string, id = crypto.randomUUID()): string {
      const now = Date.now();
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
      return id;
    }

    it("inserts and round-trips a member scope", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const fieldDefId = insertFieldDefinition(systemId);
      const id = brandId<FieldDefinitionScopeId>(crypto.randomUUID());
      const now = Date.now();

      db.insert(fieldDefinitionScopes)
        .values({
          id,
          fieldDefinitionId: fieldDefId,
          scopeType: "member",
          systemId,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db
        .select()
        .from(fieldDefinitionScopes)
        .where(eq(fieldDefinitionScopes.id, id))
        .all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.fieldDefinitionId).toBe(fieldDefId);
      expect(rows[0]?.scopeType).toBe("member");
      expect(rows[0]?.scopeEntityTypeId).toBeNull();
      expect(rows[0]?.version).toBe(1);
    });

    it("rejects nonexistent field_definition_id FK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        db
          .insert(fieldDefinitionScopes)
          .values({
            id: brandId<FieldDefinitionScopeId>(crypto.randomUUID()),
            fieldDefinitionId: brandId<FieldDefinitionId>("nonexistent"),
            scopeType: "member",
            systemId,
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("rejects nonexistent scope_entity_type_id FK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const fieldDefId = insertFieldDefinition(systemId);
      const now = Date.now();

      expect(() =>
        db
          .insert(fieldDefinitionScopes)
          .values({
            id: brandId<FieldDefinitionScopeId>(crypto.randomUUID()),
            fieldDefinitionId: fieldDefId,
            scopeType: "structure-entity-type",
            scopeEntityTypeId: brandId<SystemStructureEntityTypeId>("nonexistent"),
            systemId,
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("rejects invalid scope_type via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const fieldDefId = insertFieldDefinition(systemId);
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            "INSERT INTO field_definition_scopes (id, field_definition_id, scope_type, system_id, created_at, updated_at, version) VALUES (?, ?, 'invalid-scope', ?, ?, ?, 1)",
          )
          .run(crypto.randomUUID(), fieldDefId, systemId, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("rejects non-null scope_entity_type_id with scope_type != structure-entity-type", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const fieldDefId = insertFieldDefinition(systemId);
      const entityTypeId = brandId<SystemStructureEntityTypeId>(insertEntityType(systemId));
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            "INSERT INTO field_definition_scopes (id, field_definition_id, scope_type, scope_entity_type_id, system_id, created_at, updated_at, version) VALUES (?, ?, 'member', ?, ?, ?, ?, 1)",
          )
          .run(crypto.randomUUID(), fieldDefId, entityTypeId, systemId, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("rejects duplicate (field_definition_id, scope_type, NULL scope_entity_type_id)", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const fieldDefId = insertFieldDefinition(systemId);
      const now = Date.now();

      db.insert(fieldDefinitionScopes)
        .values({
          id: brandId<FieldDefinitionScopeId>(crypto.randomUUID()),
          fieldDefinitionId: fieldDefId,
          scopeType: "member",
          systemId,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      expect(() =>
        db
          .insert(fieldDefinitionScopes)
          .values({
            id: brandId<FieldDefinitionScopeId>(crypto.randomUUID()),
            fieldDefinitionId: fieldDefId,
            scopeType: "member",
            systemId,
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow(/UNIQUE|constraint/i);
    });

    it("rejects version 0 via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const fieldDefId = insertFieldDefinition(systemId);
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            "INSERT INTO field_definition_scopes (id, field_definition_id, scope_type, system_id, created_at, updated_at, version) VALUES (?, ?, 'member', ?, ?, ?, 0)",
          )
          .run(crypto.randomUUID(), fieldDefId, systemId, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const fieldDefId = insertFieldDefinition(systemId);
      const id = brandId<FieldDefinitionScopeId>(crypto.randomUUID());
      const now = Date.now();

      db.insert(fieldDefinitionScopes)
        .values({
          id,
          fieldDefinitionId: fieldDefId,
          scopeType: "member",
          systemId,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.delete(systems).where(eq(systems.id, systemId)).run();
      const rows = db
        .select()
        .from(fieldDefinitionScopes)
        .where(eq(fieldDefinitionScopes.id, id))
        .all();
      expect(rows).toHaveLength(0);
    });

    it("restricts deletion of field definition with dependent scopes", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const fieldDefId = insertFieldDefinition(systemId);
      const now = Date.now();

      db.insert(fieldDefinitionScopes)
        .values({
          id: brandId<FieldDefinitionScopeId>(crypto.randomUUID()),
          fieldDefinitionId: fieldDefId,
          scopeType: "member",
          systemId,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      expect(() =>
        client.prepare("DELETE FROM field_definitions WHERE id = ?").run(fieldDefId),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });
  });

  describe("field_values — structureEntityId and groupId columns", () => {
    function insertEntityType(systemId: string, id = crypto.randomUUID()): string {
      const now = Date.now();
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
      return id;
    }

    function insertEntity(
      systemId: string,
      entityTypeId: string,
      id = crypto.randomUUID(),
    ): string {
      const now = Date.now();
      db.insert(systemStructureEntities)
        .values({
          id,
          systemId,
          entityTypeId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();
      return id;
    }

    function insertGroup(systemId: string, raw = crypto.randomUUID()): GroupId {
      const id = brandId<GroupId>(raw);
      const now = Date.now();
      db.insert(groups)
        .values({
          id,
          systemId: brandId<SystemId>(systemId),
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();
      return id;
    }

    it("field value with structureEntityId only succeeds", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const fieldDefId = insertFieldDefinition(systemId);
      const entityTypeId = brandId<SystemStructureEntityTypeId>(insertEntityType(systemId));
      const entityId = brandId<SystemStructureEntityId>(insertEntity(systemId, entityTypeId));
      const id = brandId<FieldValueId>(crypto.randomUUID());
      const now = Date.now();

      db.insert(fieldValues)
        .values({
          id,
          fieldDefinitionId: fieldDefId,
          structureEntityId: entityId,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(fieldValues).where(eq(fieldValues.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.structureEntityId).toBe(entityId);
      expect(rows[0]?.memberId).toBeNull();
      expect(rows[0]?.groupId).toBeNull();
    });

    it("field value with groupId only succeeds", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const fieldDefId = insertFieldDefinition(systemId);
      const groupId = brandId<GroupId>(insertGroup(systemId));
      const id = brandId<FieldValueId>(crypto.randomUUID());
      const now = Date.now();

      db.insert(fieldValues)
        .values({
          id,
          fieldDefinitionId: fieldDefId,
          groupId,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(fieldValues).where(eq(fieldValues.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.groupId).toBe(groupId);
      expect(rows[0]?.memberId).toBeNull();
      expect(rows[0]?.structureEntityId).toBeNull();
    });

    it("rejects memberId + structureEntityId both set via subject_exclusivity_check", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const fieldDefId = insertFieldDefinition(systemId);
      const memberId = brandId<MemberId>(sqliteInsertMember(db, systemId));
      const entityTypeId = brandId<SystemStructureEntityTypeId>(insertEntityType(systemId));
      const entityId = brandId<SystemStructureEntityId>(insertEntity(systemId, entityTypeId));
      const now = Date.now();

      expect(() =>
        db
          .insert(fieldValues)
          .values({
            id: brandId<FieldValueId>(crypto.randomUUID()),
            fieldDefinitionId: fieldDefId,
            memberId,
            structureEntityId: entityId,
            systemId,
            encryptedData: testBlob(new Uint8Array([1])),
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow(/CHECK|constraint/i);
    });

    it("rejects memberId + groupId both set via subject_exclusivity_check", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const fieldDefId = insertFieldDefinition(systemId);
      const memberId = brandId<MemberId>(sqliteInsertMember(db, systemId));
      const groupId = brandId<GroupId>(insertGroup(systemId));
      const now = Date.now();

      expect(() =>
        db
          .insert(fieldValues)
          .values({
            id: brandId<FieldValueId>(crypto.randomUUID()),
            fieldDefinitionId: fieldDefId,
            memberId,
            groupId,
            systemId,
            encryptedData: testBlob(new Uint8Array([1])),
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow(/CHECK|constraint/i);
    });

    it("rejects structureEntityId + groupId both set via subject_exclusivity_check", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const fieldDefId = insertFieldDefinition(systemId);
      const entityTypeId = brandId<SystemStructureEntityTypeId>(insertEntityType(systemId));
      const entityId = brandId<SystemStructureEntityId>(insertEntity(systemId, entityTypeId));
      const groupId = brandId<GroupId>(insertGroup(systemId));
      const now = Date.now();

      expect(() =>
        db
          .insert(fieldValues)
          .values({
            id: brandId<FieldValueId>(crypto.randomUUID()),
            fieldDefinitionId: fieldDefId,
            structureEntityId: entityId,
            groupId,
            systemId,
            encryptedData: testBlob(new Uint8Array([1])),
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow(/CHECK|constraint/i);
    });

    it("rejects all three subject columns set via subject_exclusivity_check", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const fieldDefId = insertFieldDefinition(systemId);
      const memberId = brandId<MemberId>(sqliteInsertMember(db, systemId));
      const entityTypeId = brandId<SystemStructureEntityTypeId>(insertEntityType(systemId));
      const entityId = brandId<SystemStructureEntityId>(insertEntity(systemId, entityTypeId));
      const groupId = brandId<GroupId>(insertGroup(systemId));
      const now = Date.now();

      expect(() =>
        db
          .insert(fieldValues)
          .values({
            id: brandId<FieldValueId>(crypto.randomUUID()),
            fieldDefinitionId: fieldDefId,
            memberId,
            structureEntityId: entityId,
            groupId,
            systemId,
            encryptedData: testBlob(new Uint8Array([1])),
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow(/CHECK|constraint/i);
    });

    it("restricts deletion of structure entity with dependent field values", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const fieldDefId = insertFieldDefinition(systemId);
      const entityTypeId = brandId<SystemStructureEntityTypeId>(insertEntityType(systemId));
      const entityId = brandId<SystemStructureEntityId>(insertEntity(systemId, entityTypeId));
      const now = Date.now();

      db.insert(fieldValues)
        .values({
          id: brandId<FieldValueId>(crypto.randomUUID()),
          fieldDefinitionId: fieldDefId,
          structureEntityId: entityId,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      expect(() =>
        client.prepare("DELETE FROM system_structure_entities WHERE id = ?").run(entityId),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("restricts deletion of group with dependent field values", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const fieldDefId = insertFieldDefinition(systemId);
      const groupId = brandId<GroupId>(insertGroup(systemId));
      const now = Date.now();

      db.insert(fieldValues)
        .values({
          id: brandId<FieldValueId>(crypto.randomUUID()),
          fieldDefinitionId: fieldDefId,
          groupId,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      expect(() => client.prepare("DELETE FROM groups WHERE id = ?").run(groupId)).toThrow(
        /FOREIGN KEY|constraint/i,
      );
    });

    it("rejects nonexistent structureEntityId FK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const fieldDefId = insertFieldDefinition(systemId);
      const now = Date.now();

      expect(() =>
        db
          .insert(fieldValues)
          .values({
            id: brandId<FieldValueId>(crypto.randomUUID()),
            fieldDefinitionId: fieldDefId,
            structureEntityId: brandId<SystemStructureEntityId>("nonexistent"),
            systemId,
            encryptedData: testBlob(new Uint8Array([1])),
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("rejects nonexistent groupId FK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const fieldDefId = insertFieldDefinition(systemId);
      const now = Date.now();

      expect(() =>
        db
          .insert(fieldValues)
          .values({
            id: brandId<FieldValueId>(crypto.randomUUID()),
            fieldDefinitionId: fieldDefId,
            groupId: brandId<GroupId>("nonexistent"),
            systemId,
            encryptedData: testBlob(new Uint8Array([1])),
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("rejects duplicate (fieldDefinitionId, structureEntityId) via definition_entity_uniq", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const fieldDefId = insertFieldDefinition(systemId);
      const entityTypeId = brandId<SystemStructureEntityTypeId>(insertEntityType(systemId));
      const entityId = brandId<SystemStructureEntityId>(insertEntity(systemId, entityTypeId));
      const now = Date.now();

      db.insert(fieldValues)
        .values({
          id: brandId<FieldValueId>(crypto.randomUUID()),
          fieldDefinitionId: fieldDefId,
          structureEntityId: entityId,
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
            structureEntityId: entityId,
            systemId,
            encryptedData: testBlob(),
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow(/UNIQUE|constraint/i);
    });

    it("rejects duplicate (fieldDefinitionId, groupId) via definition_group_uniq", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const fieldDefId = insertFieldDefinition(systemId);
      const groupId = brandId<GroupId>(insertGroup(systemId));
      const now = Date.now();

      db.insert(fieldValues)
        .values({
          id: brandId<FieldValueId>(crypto.randomUUID()),
          fieldDefinitionId: fieldDefId,
          groupId,
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
            groupId,
            systemId,
            encryptedData: testBlob(),
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow(/UNIQUE|constraint/i);
    });
  });
});
