import { brandId } from "@pluralscape/types";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { systemStructureEntities, systemStructureEntityTypes } from "../schema/pg/structure.js";
import { systems } from "../schema/pg/systems.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import { testBlob } from "./helpers/pg-helpers.js";
import {
  newEntityId,
  newTypeId,
  setupStructureFixture,
  teardownStructureFixture,
  clearStructureTables,
  insertAccount as insertAccountWith,
  insertSystem as insertSystemWith,
  type StructureDb,
} from "./helpers/structure-fixtures.js";

import type { PGlite } from "@electric-sql/pglite";
import type { SystemId, SystemStructureEntityTypeId } from "@pluralscape/types";

describe("PG structure schema — types and entities", () => {
  let client: PGlite;
  let db: StructureDb;

  const insertAccount = (id?: string) => insertAccountWith(db, id);
  const insertSystem = (accountId: string, id?: string) => insertSystemWith(db, accountId, id);

  beforeAll(async () => {
    const fixture = await setupStructureFixture();
    client = fixture.client;
    db = fixture.db;
  });

  afterAll(async () => {
    await teardownStructureFixture({ client, db });
  });

  afterEach(async () => {
    await clearStructureTables(db);
  });

  describe("systemStructureEntityTypes", () => {
    it("inserts and round-trips encrypted data", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = newTypeId();
      const now = fixtureNow();
      const data = testBlob(new Uint8Array([10, 20]));

      await db.insert(systemStructureEntityTypes).values({
        id,
        systemId,
        sortOrder: 0,
        encryptedData: data,
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db
        .select()
        .from(systemStructureEntityTypes)
        .where(eq(systemStructureEntityTypes.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
    });

    it("defaults version to 1", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = newTypeId();
      const now = fixtureNow();

      await db.insert(systemStructureEntityTypes).values({
        id,
        systemId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db
        .select()
        .from(systemStructureEntityTypes)
        .where(eq(systemStructureEntityTypes.id, id));
      expect(rows[0]?.version).toBe(1);
    });

    it("rejects nonexistent systemId FK", async () => {
      const now = fixtureNow();
      await expect(
        db.insert(systemStructureEntityTypes).values({
          id: newTypeId(),
          systemId: brandId<SystemId>("nonexistent"),
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("defaults archived to false", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = newTypeId();
      const now = fixtureNow();

      await db.insert(systemStructureEntityTypes).values({
        id,
        systemId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db
        .select()
        .from(systemStructureEntityTypes)
        .where(eq(systemStructureEntityTypes.id, id));
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("round-trips archived: true with archivedAt", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = newTypeId();
      const now = fixtureNow();

      await db.insert(systemStructureEntityTypes).values({
        id,
        systemId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
        archived: true,
        archivedAt: now,
      });

      const rows = await db
        .select()
        .from(systemStructureEntityTypes)
        .where(eq(systemStructureEntityTypes.id, id));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = newTypeId();
      const now = fixtureNow();

      await db.insert(systemStructureEntityTypes).values({
        id,
        systemId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db
        .select()
        .from(systemStructureEntityTypes)
        .where(eq(systemStructureEntityTypes.id, id));
      expect(rows).toHaveLength(0);
    });

    it("rejects archived=true with null archivedAt", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = fixtureNow();

      await expect(
        client.query(
          "INSERT INTO system_structure_entity_types (id, system_id, sort_order, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES ($1, $2, 0, '\\x0102'::bytea, $3, $4, 1, true, NULL)",
          [crypto.randomUUID(), systemId, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });

    it("rejects archived=false with non-null archivedAt", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = fixtureNow();

      await expect(
        client.query(
          "INSERT INTO system_structure_entity_types (id, system_id, sort_order, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES ($1, $2, 0, '\\x0102'::bytea, $3, $4, 1, false, $5)",
          [crypto.randomUUID(), systemId, now, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });

    it("rejects version 0", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = fixtureNow();

      await expect(
        client.query(
          "INSERT INTO system_structure_entity_types (id, system_id, sort_order, encrypted_data, created_at, updated_at, version, archived) VALUES ($1, $2, 0, '\\x0102'::bytea, $3, $4, 0, false)",
          [crypto.randomUUID(), systemId, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });
  });

  describe("systemStructureEntities", () => {
    it("inserts and round-trips data", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const typeId = newTypeId();
      const now = fixtureNow();

      await db.insert(systemStructureEntityTypes).values({
        id: typeId,
        systemId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });

      const entityId = newEntityId();
      const data = testBlob(new Uint8Array([30, 40]));
      await db.insert(systemStructureEntities).values({
        id: entityId,
        systemId,
        entityTypeId: typeId,
        sortOrder: 0,
        encryptedData: data,
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db
        .select()
        .from(systemStructureEntities)
        .where(eq(systemStructureEntities.id, entityId));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.entityTypeId).toBe(typeId);
    });

    it("rejects nonexistent entityTypeId FK (RESTRICT)", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = fixtureNow();

      await expect(
        db.insert(systemStructureEntities).values({
          id: newEntityId(),
          systemId,
          entityTypeId: brandId<SystemStructureEntityTypeId>("nonexistent"),
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("prevents deletion of entity type with dependent entities (RESTRICT)", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const typeId = newTypeId();
      const now = fixtureNow();

      await db.insert(systemStructureEntityTypes).values({
        id: typeId,
        systemId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(systemStructureEntities).values({
        id: newEntityId(),
        systemId,
        entityTypeId: typeId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        db.delete(systemStructureEntityTypes).where(eq(systemStructureEntityTypes.id, typeId)),
      ).rejects.toThrow();
    });

    it("defaults archived to false", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const typeId = newTypeId();
      const now = fixtureNow();

      await db.insert(systemStructureEntityTypes).values({
        id: typeId,
        systemId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });

      const entityId = newEntityId();
      await db.insert(systemStructureEntities).values({
        id: entityId,
        systemId,
        entityTypeId: typeId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db
        .select()
        .from(systemStructureEntities)
        .where(eq(systemStructureEntities.id, entityId));
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("defaults version to 1", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const typeId = newTypeId();
      const now = fixtureNow();

      await db.insert(systemStructureEntityTypes).values({
        id: typeId,
        systemId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });

      const entityId = newEntityId();
      await db.insert(systemStructureEntities).values({
        id: entityId,
        systemId,
        entityTypeId: typeId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db
        .select()
        .from(systemStructureEntities)
        .where(eq(systemStructureEntities.id, entityId));
      expect(rows[0]?.version).toBe(1);
    });

    it("rejects archived=true with null archivedAt", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const typeId = newTypeId();
      const now = fixtureNow();

      await db.insert(systemStructureEntityTypes).values({
        id: typeId,
        systemId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        client.query(
          "INSERT INTO system_structure_entities (id, system_id, entity_type_id, sort_order, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES ($1, $2, $3, 0, '\\x0102'::bytea, $4, $5, 1, true, NULL)",
          [crypto.randomUUID(), systemId, typeId, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });

    it("rejects archived=false with non-null archivedAt", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const typeId = newTypeId();
      const now = fixtureNow();

      await db.insert(systemStructureEntityTypes).values({
        id: typeId,
        systemId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        client.query(
          "INSERT INTO system_structure_entities (id, system_id, entity_type_id, sort_order, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES ($1, $2, $3, 0, '\\x0102'::bytea, $4, $5, 1, false, $6)",
          [crypto.randomUUID(), systemId, typeId, now, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });

    it("rejects version 0", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const typeId = newTypeId();
      const now = fixtureNow();

      await db.insert(systemStructureEntityTypes).values({
        id: typeId,
        systemId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        client.query(
          "INSERT INTO system_structure_entities (id, system_id, entity_type_id, sort_order, encrypted_data, created_at, updated_at, version, archived) VALUES ($1, $2, $3, 0, '\\x0102'::bytea, $4, $5, 0, false)",
          [crypto.randomUUID(), systemId, typeId, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const typeId = newTypeId();
      const entityId = newEntityId();
      const now = fixtureNow();

      await db.insert(systemStructureEntityTypes).values({
        id: typeId,
        systemId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(systemStructureEntities).values({
        id: entityId,
        systemId,
        entityTypeId: typeId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db
        .select()
        .from(systemStructureEntities)
        .where(eq(systemStructureEntities.id, entityId));
      expect(rows).toHaveLength(0);
    });
  });
});
