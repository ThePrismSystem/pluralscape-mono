/**
 * SQLite custom fields schema — field_values structureEntityId and groupId columns.
 *
 * Covers: field_values extended (structureEntityId, groupId, exclusivity CHECKs,
 *   FK restrictions, uniqueness) = 11 tests.
 *
 * Source: schema-sqlite-custom-fields.integration.test.ts (lines 1007-1386)
 */

import { brandId } from "@pluralscape/types";
import Database from "better-sqlite3-multiple-ciphers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/sqlite/auth.js";
import { fieldDefinitions, fieldValues } from "../schema/sqlite/custom-fields.js";
import { groups } from "../schema/sqlite/groups.js";
import { systemStructureEntities, systemStructureEntityTypes } from "../schema/sqlite/structure.js";
import { systems } from "../schema/sqlite/systems.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import {
  createSqliteCustomFieldsTables,
  sqliteInsertAccount,
  sqliteInsertMember,
  sqliteInsertSystem,
  testBlob,
} from "./helpers/sqlite-helpers.js";

import type {
  FieldDefinitionId,
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
  groups,
  systemStructureEntityTypes,
  systemStructureEntities,
  fieldDefinitions,
  fieldValues,
};

describe("SQLite custom fields schema — field_values extended (structureEntityId and groupId)", () => {
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

  function insertEntity(
    systemId: SystemId,
    entityTypeId: SystemStructureEntityTypeId,
    id = brandId<SystemStructureEntityId>(crypto.randomUUID()),
  ): SystemStructureEntityId {
    const now = fixtureNow();
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
    const now = fixtureNow();
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
    db.delete(systemStructureEntities).run();
    db.delete(systemStructureEntityTypes).run();
    db.delete(groups).run();
  });

  describe("field_values — structureEntityId and groupId columns", () => {
    it("field value with structureEntityId only succeeds", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const fieldDefId = insertFieldDefinition(systemId);
      const entityTypeId = brandId<SystemStructureEntityTypeId>(insertEntityType(systemId));
      const entityId = brandId<SystemStructureEntityId>(insertEntity(systemId, entityTypeId));
      const id = brandId<FieldValueId>(crypto.randomUUID());
      const now = fixtureNow();

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
      const now = fixtureNow();

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
      const now = fixtureNow();

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
      const now = fixtureNow();

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
      const now = fixtureNow();

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
      const now = fixtureNow();

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
      const now = fixtureNow();

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
      const now = fixtureNow();

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
      const now = fixtureNow();

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
      const now = fixtureNow();

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
      const now = fixtureNow();

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
      const now = fixtureNow();

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
