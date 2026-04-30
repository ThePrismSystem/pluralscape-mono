/**
 * SQLite custom fields schema — field_bucket_visibility and field_definition_scopes tables.
 *
 * Covers: field_bucket_visibility (7 tests), field_definition_scopes (9 tests) = 16 tests.
 *
 * Source: schema-sqlite-custom-fields.integration.test.ts (lines 644-1005)
 */

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
} from "../schema/sqlite/custom-fields.js";
import { buckets } from "../schema/sqlite/privacy.js";
import { systemStructureEntityTypes } from "../schema/sqlite/structure.js";
import { systems } from "../schema/sqlite/systems.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import {
  createSqliteCustomFieldsTables,
  sqliteInsertAccount,
  sqliteInsertSystem,
  testBlob,
} from "./helpers/sqlite-helpers.js";

import type {
  BucketId,
  FieldDefinitionId,
  FieldDefinitionScopeId,
  SystemId,
  SystemStructureEntityTypeId,
} from "@pluralscape/types";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = {
  accounts,
  systems,
  buckets,
  systemStructureEntityTypes,
  fieldDefinitions,
  fieldDefinitionScopes,
  fieldBucketVisibility,
};

describe("SQLite custom fields schema — field_bucket_visibility and field_definition_scopes", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  const insertAccount = (id?: string) => sqliteInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string) => sqliteInsertSystem(db, accountId, id);

  function insertBucket(
    systemId: SystemId,
    id: BucketId = brandId<BucketId>(crypto.randomUUID()),
  ): BucketId {
    const now = fixtureNow();
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

  function insertEntityType(
    systemId: SystemId,
    id = brandId<SystemStructureEntityTypeId>(crypto.randomUUID()),
  ): SystemStructureEntityTypeId {
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
    db.delete(fieldDefinitionScopes).run();
    db.delete(fieldDefinitions).run();
    db.delete(buckets).run();
    db.delete(systemStructureEntityTypes).run();
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

  // ── field_definition_scopes ────────────────────────────────────────

  describe("field_definition_scopes", () => {
    it("inserts and round-trips a member scope", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const fieldDefId = insertFieldDefinition(systemId);
      const id = brandId<FieldDefinitionScopeId>(crypto.randomUUID());
      const now = fixtureNow();

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
      const now = fixtureNow();

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
      const now = fixtureNow();

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
      const now = fixtureNow();

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
      const now = fixtureNow();

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
      const now = fixtureNow();

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
      const now = fixtureNow();

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
      const now = fixtureNow();

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
      const now = fixtureNow();

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
});
