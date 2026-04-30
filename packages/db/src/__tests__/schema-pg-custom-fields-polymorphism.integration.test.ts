import { brandId } from "@pluralscape/types";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { fieldValues } from "../schema/pg/custom-fields.js";
import { groups } from "../schema/pg/groups.js";
import { systemStructureEntities, systemStructureEntityTypes } from "../schema/pg/structure.js";

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
import { pgInsertMember, testBlob } from "./helpers/pg-helpers.js";

import type { PGlite } from "@electric-sql/pglite";
import type {
  FieldDefinitionId,
  FieldValueId,
  GroupId,
  MemberId,
  SystemId,
  SystemStructureEntityId,
  SystemStructureEntityTypeId,
} from "@pluralscape/types";

describe("PG custom fields schema — values polymorphism (T3 columns)", () => {
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
