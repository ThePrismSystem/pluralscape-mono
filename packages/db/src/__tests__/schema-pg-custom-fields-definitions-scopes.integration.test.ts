import { brandId } from "@pluralscape/types";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { fieldDefinitionScopes, fieldDefinitions } from "../schema/pg/custom-fields.js";
import { systemStructureEntityTypes } from "../schema/pg/structure.js";
import { systems } from "../schema/pg/systems.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import {
  clearCustomFieldsTables,
  insertAccount as insertAccountWith,
  insertFieldDefinition as insertFieldDefinitionWith,
  insertSystem as insertSystemWith,
  setupCustomFieldsFixture,
  teardownCustomFieldsFixture,
  type CustomFieldsDb,
} from "./helpers/custom-fields-fixtures.js";
import { testBlob } from "./helpers/pg-helpers.js";

import type { PGlite } from "@electric-sql/pglite";
import type {
  FieldDefinitionId,
  FieldDefinitionScopeId,
  SystemId,
  SystemStructureEntityTypeId,
} from "@pluralscape/types";

describe("PG custom fields schema — definitions and scopes", () => {
  let client: PGlite;
  let db: CustomFieldsDb;

  const insertAccount = (id?: string) => insertAccountWith(db, id);
  const insertSystem = (accountId: string, id?: string) => insertSystemWith(db, accountId, id);
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
});
