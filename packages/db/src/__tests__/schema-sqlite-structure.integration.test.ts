import Database from "better-sqlite3-multiple-ciphers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/sqlite/auth.js";
import { members } from "../schema/sqlite/members.js";
import {
  relationships,
  systemStructureEntityAssociations,
  systemStructureEntities,
  systemStructureEntityLinks,
  systemStructureEntityMemberLinks,
  systemStructureEntityTypes,
} from "../schema/sqlite/structure.js";
import { systems } from "../schema/sqlite/systems.js";

import {
  createSqliteStructureTables,
  sqliteInsertAccount,
  sqliteInsertMember,
  sqliteInsertSystem,
  testBlob,
} from "./helpers/sqlite-helpers.js";

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = {
  accounts,
  systems,
  members,
  relationships,
  systemStructureEntityTypes,
  systemStructureEntities,
  systemStructureEntityLinks,
  systemStructureEntityMemberLinks,
  systemStructureEntityAssociations,
};

describe("SQLite structure schema", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  const insertAccount = (id?: string) => sqliteInsertAccount(db, id);
  const insertMember = (systemId: string, id?: string): string =>
    sqliteInsertMember(db, systemId, id);
  const insertSystem = (accountId: string, id?: string): string =>
    sqliteInsertSystem(db, accountId, id);

  beforeAll(() => {
    client = new Database(":memory:");
    client.pragma("foreign_keys = ON");
    db = drizzle(client, { schema });
    createSqliteStructureTables(client);
  });

  afterAll(() => {
    client.close();
  });

  afterEach(() => {
    db.delete(systemStructureEntityAssociations).run();
    db.delete(systemStructureEntityMemberLinks).run();
    db.delete(systemStructureEntityLinks).run();
    db.delete(systemStructureEntities).run();
    db.delete(systemStructureEntityTypes).run();
    db.delete(relationships).run();
  });

  describe("relationships", () => {
    it("inserts and round-trips encrypted data", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = testBlob(new Uint8Array([10, 20, 30, 40, 50]));

      db.insert(relationships)
        .values({
          id,
          systemId,
          type: "sibling",
          encryptedData: data,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(relationships).where(eq(relationships.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.systemId).toBe(systemId);
    });

    it("defaults version to 1", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(relationships)
        .values({
          id,
          systemId,
          type: "sibling",
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(relationships).where(eq(relationships.id, id)).all();
      expect(rows[0]?.version).toBe(1);
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(relationships)
        .values({
          id,
          systemId,
          type: "sibling",
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.delete(systems).where(eq(systems.id, systemId)).run();
      const rows = db.select().from(relationships).where(eq(relationships.id, id)).all();
      expect(rows).toHaveLength(0);
    });

    it("rejects nonexistent systemId FK", () => {
      const now = Date.now();
      expect(() =>
        db
          .insert(relationships)
          .values({
            id: crypto.randomUUID(),
            systemId: "nonexistent",
            type: "sibling",
            encryptedData: testBlob(new Uint8Array([1])),
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("round-trips T3 metadata columns", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const sourceMemberId = insertMember(systemId);
      const targetMemberId = insertMember(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(relationships)
        .values({
          id,
          systemId,
          sourceMemberId,
          targetMemberId,
          type: "sibling",
          bidirectional: true,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(relationships).where(eq(relationships.id, id)).all();
      expect(rows[0]?.sourceMemberId).toBe(sourceMemberId);
      expect(rows[0]?.targetMemberId).toBe(targetMemberId);
      expect(rows[0]?.type).toBe("sibling");
      expect(rows[0]?.bidirectional).toBe(true);
    });

    it("defaults T3 metadata to null", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(relationships)
        .values({
          id,
          systemId,
          type: "sibling",
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(relationships).where(eq(relationships.id, id)).all();
      expect(rows[0]?.sourceMemberId).toBeNull();
      expect(rows[0]?.targetMemberId).toBeNull();
      expect(rows[0]?.bidirectional).toBe(false);
    });

    it("rejects invalid type via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        db
          .insert(relationships)
          .values({
            id: crypto.randomUUID(),
            systemId,
            type: "invalid" as "sibling",
            encryptedData: testBlob(new Uint8Array([1])),
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow(/CHECK|constraint/i);
    });

    it("sets sourceMemberId to null on member deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(relationships)
        .values({
          id,
          systemId,
          type: "sibling",
          sourceMemberId: memberId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.delete(members).where(eq(members.id, memberId)).run();
      const rows = db.select().from(relationships).where(eq(relationships.id, id)).all();
      expect(rows[0]?.sourceMemberId).toBeNull();
    });

    it("rejects nonexistent sourceMemberId FK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        db
          .insert(relationships)
          .values({
            id: crypto.randomUUID(),
            systemId,
            type: "sibling",
            sourceMemberId: "nonexistent",
            encryptedData: testBlob(new Uint8Array([1])),
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("sets targetMemberId to null on member deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(relationships)
        .values({
          id,
          systemId,
          type: "sibling",
          targetMemberId: memberId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.delete(members).where(eq(members.id, memberId)).run();
      const rows = db.select().from(relationships).where(eq(relationships.id, id)).all();
      expect(rows[0]?.targetMemberId).toBeNull();
    });

    it("rejects nonexistent targetMemberId FK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        db
          .insert(relationships)
          .values({
            id: crypto.randomUUID(),
            systemId,
            type: "sibling",
            targetMemberId: "nonexistent",
            encryptedData: testBlob(new Uint8Array([1])),
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("defaults archived to false and archivedAt to null", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(relationships)
        .values({
          id,
          systemId,
          type: "sibling",
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(relationships).where(eq(relationships.id, id)).all();
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("round-trips archived: true with archivedAt timestamp", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(relationships)
        .values({
          id,
          systemId,
          type: "sibling",
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
          archived: true,
          archivedAt: now,
        })
        .run();

      const rows = db.select().from(relationships).where(eq(relationships.id, id)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("rejects archived=true with archivedAt=null via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            `INSERT INTO relationships (id, system_id, type, encrypted_data, created_at, updated_at, archived, archived_at)
             VALUES (?, ?, 'sibling', X'0102', ?, ?, 1, NULL)`,
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
            `INSERT INTO relationships (id, system_id, type, encrypted_data, created_at, updated_at, archived, archived_at)
             VALUES (?, ?, 'sibling', X'0102', ?, ?, 0, ?)`,
          )
          .run(crypto.randomUUID(), systemId, now, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("updates archived from false to true", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(relationships)
        .values({
          id,
          systemId,
          type: "sibling",
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.update(relationships)
        .set({ archived: true, archivedAt: now, updatedAt: now })
        .where(eq(relationships.id, id))
        .run();

      const rows = db.select().from(relationships).where(eq(relationships.id, id)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });
  });

  // ── Structure Entity Types ─────────────────────────────────────────

  describe("systemStructureEntityTypes", () => {
    it("inserts and round-trips encrypted data", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = testBlob(new Uint8Array([10, 20]));

      db.insert(systemStructureEntityTypes)
        .values({ id, systemId, sortOrder: 0, encryptedData: data, createdAt: now, updatedAt: now })
        .run();

      const rows = db
        .select()
        .from(systemStructureEntityTypes)
        .where(eq(systemStructureEntityTypes.id, id))
        .all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
    });

    it("defaults version to 1", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
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

      const rows = db
        .select()
        .from(systemStructureEntityTypes)
        .where(eq(systemStructureEntityTypes.id, id))
        .all();
      expect(rows[0]?.version).toBe(1);
    });

    it("rejects nonexistent systemId FK", () => {
      const now = Date.now();
      expect(() =>
        db
          .insert(systemStructureEntityTypes)
          .values({
            id: crypto.randomUUID(),
            systemId: "nonexistent",
            sortOrder: 0,
            encryptedData: testBlob(),
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("defaults archived to false", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
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

      const rows = db
        .select()
        .from(systemStructureEntityTypes)
        .where(eq(systemStructureEntityTypes.id, id))
        .all();
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
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

      db.delete(systems).where(eq(systems.id, systemId)).run();
      const rows = db
        .select()
        .from(systemStructureEntityTypes)
        .where(eq(systemStructureEntityTypes.id, id))
        .all();
      expect(rows).toHaveLength(0);
    });

    it("rejects archived=true with null archivedAt", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            `INSERT INTO system_structure_entity_types (id, system_id, sort_order, encrypted_data, created_at, updated_at, archived, archived_at)
             VALUES (?, ?, 0, X'0102', ?, ?, 1, NULL)`,
          )
          .run(crypto.randomUUID(), systemId, now, now),
      ).toThrow(/check|constraint/i);
    });

    it("rejects archived=false with non-null archivedAt", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            `INSERT INTO system_structure_entity_types (id, system_id, sort_order, encrypted_data, created_at, updated_at, archived, archived_at)
             VALUES (?, ?, 0, X'0102', ?, ?, 0, ?)`,
          )
          .run(crypto.randomUUID(), systemId, now, now, now),
      ).toThrow(/check|constraint/i);
    });

    it("rejects version 0", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            `INSERT INTO system_structure_entity_types (id, system_id, sort_order, encrypted_data, created_at, updated_at, version)
             VALUES (?, ?, 0, X'0102', ?, ?, 0)`,
          )
          .run(crypto.randomUUID(), systemId, now, now),
      ).toThrow(/check|constraint/i);
    });
  });

  // ── Structure Entities ─────────────────────────────────────────────

  describe("systemStructureEntities", () => {
    it("inserts and round-trips data", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const typeId = crypto.randomUUID();
      const now = Date.now();

      db.insert(systemStructureEntityTypes)
        .values({
          id: typeId,
          systemId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const entityId = crypto.randomUUID();
      const data = testBlob(new Uint8Array([30, 40]));
      db.insert(systemStructureEntities)
        .values({
          id: entityId,
          systemId,
          entityTypeId: typeId,
          sortOrder: 0,
          encryptedData: data,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db
        .select()
        .from(systemStructureEntities)
        .where(eq(systemStructureEntities.id, entityId))
        .all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.entityTypeId).toBe(typeId);
    });

    it("rejects nonexistent entityTypeId FK (RESTRICT)", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        db
          .insert(systemStructureEntities)
          .values({
            id: crypto.randomUUID(),
            systemId,
            entityTypeId: "nonexistent",
            sortOrder: 0,
            encryptedData: testBlob(),
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("prevents deletion of entity type with dependent entities (RESTRICT)", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const typeId = crypto.randomUUID();
      const now = Date.now();

      db.insert(systemStructureEntityTypes)
        .values({
          id: typeId,
          systemId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.insert(systemStructureEntities)
        .values({
          id: crypto.randomUUID(),
          systemId,
          entityTypeId: typeId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      expect(() =>
        db
          .delete(systemStructureEntityTypes)
          .where(eq(systemStructureEntityTypes.id, typeId))
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("defaults version to 1", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const typeId = crypto.randomUUID();
      const now = Date.now();

      db.insert(systemStructureEntityTypes)
        .values({
          id: typeId,
          systemId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const entityId = crypto.randomUUID();
      db.insert(systemStructureEntities)
        .values({
          id: entityId,
          systemId,
          entityTypeId: typeId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db
        .select()
        .from(systemStructureEntities)
        .where(eq(systemStructureEntities.id, entityId))
        .all();
      expect(rows[0]?.version).toBe(1);
    });

    it("rejects archived=true with null archivedAt", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const typeId = crypto.randomUUID();
      const now = Date.now();

      db.insert(systemStructureEntityTypes)
        .values({
          id: typeId,
          systemId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      expect(() =>
        client
          .prepare(
            `INSERT INTO system_structure_entities (id, system_id, entity_type_id, sort_order, encrypted_data, created_at, updated_at, archived, archived_at)
             VALUES (?, ?, ?, 0, X'0102', ?, ?, 1, NULL)`,
          )
          .run(crypto.randomUUID(), systemId, typeId, now, now),
      ).toThrow(/check|constraint/i);
    });

    it("rejects archived=false with non-null archivedAt", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const typeId = crypto.randomUUID();
      const now = Date.now();

      db.insert(systemStructureEntityTypes)
        .values({
          id: typeId,
          systemId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      expect(() =>
        client
          .prepare(
            `INSERT INTO system_structure_entities (id, system_id, entity_type_id, sort_order, encrypted_data, created_at, updated_at, archived, archived_at)
             VALUES (?, ?, ?, 0, X'0102', ?, ?, 0, ?)`,
          )
          .run(crypto.randomUUID(), systemId, typeId, now, now, now),
      ).toThrow(/check|constraint/i);
    });

    it("rejects version 0", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const typeId = crypto.randomUUID();
      const now = Date.now();

      db.insert(systemStructureEntityTypes)
        .values({
          id: typeId,
          systemId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      expect(() =>
        client
          .prepare(
            `INSERT INTO system_structure_entities (id, system_id, entity_type_id, sort_order, encrypted_data, created_at, updated_at, version)
             VALUES (?, ?, ?, 0, X'0102', ?, ?, 0)`,
          )
          .run(crypto.randomUUID(), systemId, typeId, now, now),
      ).toThrow(/check|constraint/i);
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const typeId = crypto.randomUUID();
      const entityId = crypto.randomUUID();
      const now = Date.now();

      db.insert(systemStructureEntityTypes)
        .values({
          id: typeId,
          systemId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();
      db.insert(systemStructureEntities)
        .values({
          id: entityId,
          systemId,
          entityTypeId: typeId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.delete(systems).where(eq(systems.id, systemId)).run();
      const rows = db
        .select()
        .from(systemStructureEntities)
        .where(eq(systemStructureEntities.id, entityId))
        .all();
      expect(rows).toHaveLength(0);
    });
  });

  // ── Structure Entity Links ─────────────────────────────────────────

  describe("systemStructureEntityLinks", () => {
    it("inserts and round-trips data", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const typeId = crypto.randomUUID();
      const entityId = crypto.randomUUID();
      const now = Date.now();

      db.insert(systemStructureEntityTypes)
        .values({
          id: typeId,
          systemId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();
      db.insert(systemStructureEntities)
        .values({
          id: entityId,
          systemId,
          entityTypeId: typeId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const linkId = crypto.randomUUID();
      db.insert(systemStructureEntityLinks)
        .values({ id: linkId, systemId, entityId, sortOrder: 0, createdAt: now })
        .run();

      const rows = db
        .select()
        .from(systemStructureEntityLinks)
        .where(eq(systemStructureEntityLinks.id, linkId))
        .all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.entityId).toBe(entityId);
      expect(rows[0]?.parentEntityId).toBeNull();
    });

    it("rejects nonexistent entityId FK (RESTRICT)", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        db
          .insert(systemStructureEntityLinks)
          .values({
            id: crypto.randomUUID(),
            systemId,
            entityId: "nonexistent",
            sortOrder: 0,
            createdAt: now,
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("prevents deletion of entity with dependent links (RESTRICT)", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const typeId = crypto.randomUUID();
      const entityId = crypto.randomUUID();
      const now = Date.now();

      db.insert(systemStructureEntityTypes)
        .values({
          id: typeId,
          systemId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();
      db.insert(systemStructureEntities)
        .values({
          id: entityId,
          systemId,
          entityTypeId: typeId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();
      db.insert(systemStructureEntityLinks)
        .values({ id: crypto.randomUUID(), systemId, entityId, sortOrder: 0, createdAt: now })
        .run();

      expect(() =>
        db.delete(systemStructureEntities).where(eq(systemStructureEntities.id, entityId)).run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("round-trips parentEntityId", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const typeId = crypto.randomUUID();
      const parentEntityId = crypto.randomUUID();
      const childEntityId = crypto.randomUUID();
      const now = Date.now();

      db.insert(systemStructureEntityTypes)
        .values({
          id: typeId,
          systemId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();
      db.insert(systemStructureEntities)
        .values([
          {
            id: parentEntityId,
            systemId,
            entityTypeId: typeId,
            sortOrder: 0,
            encryptedData: testBlob(),
            createdAt: now,
            updatedAt: now,
          },
          {
            id: childEntityId,
            systemId,
            entityTypeId: typeId,
            sortOrder: 1,
            encryptedData: testBlob(),
            createdAt: now,
            updatedAt: now,
          },
        ])
        .run();

      const linkId = crypto.randomUUID();
      db.insert(systemStructureEntityLinks)
        .values({
          id: linkId,
          systemId,
          entityId: childEntityId,
          parentEntityId,
          sortOrder: 0,
          createdAt: now,
        })
        .run();

      const rows = db
        .select()
        .from(systemStructureEntityLinks)
        .where(eq(systemStructureEntityLinks.id, linkId))
        .all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.parentEntityId).toBe(parentEntityId);
    });

    it("rejects nonexistent parentEntityId FK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const typeId = crypto.randomUUID();
      const entityId = crypto.randomUUID();
      const now = Date.now();

      db.insert(systemStructureEntityTypes)
        .values({
          id: typeId,
          systemId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();
      db.insert(systemStructureEntities)
        .values({
          id: entityId,
          systemId,
          entityTypeId: typeId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      expect(() =>
        db
          .insert(systemStructureEntityLinks)
          .values({
            id: crypto.randomUUID(),
            systemId,
            entityId,
            parentEntityId: "nonexistent",
            sortOrder: 0,
            createdAt: now,
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("restricts deletion of parent entity with dependent link", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const typeId = crypto.randomUUID();
      const parentEntityId = crypto.randomUUID();
      const childEntityId = crypto.randomUUID();
      const now = Date.now();

      db.insert(systemStructureEntityTypes)
        .values({
          id: typeId,
          systemId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();
      db.insert(systemStructureEntities)
        .values([
          {
            id: parentEntityId,
            systemId,
            entityTypeId: typeId,
            sortOrder: 0,
            encryptedData: testBlob(),
            createdAt: now,
            updatedAt: now,
          },
          {
            id: childEntityId,
            systemId,
            entityTypeId: typeId,
            sortOrder: 1,
            encryptedData: testBlob(),
            createdAt: now,
            updatedAt: now,
          },
        ])
        .run();
      db.insert(systemStructureEntityLinks)
        .values({
          id: crypto.randomUUID(),
          systemId,
          entityId: childEntityId,
          parentEntityId,
          sortOrder: 0,
          createdAt: now,
        })
        .run();

      expect(() =>
        db
          .delete(systemStructureEntities)
          .where(eq(systemStructureEntities.id, parentEntityId))
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("enforces unique (entityId, parentEntityId)", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const typeId = crypto.randomUUID();
      const parentEntityId = crypto.randomUUID();
      const childEntityId = crypto.randomUUID();
      const now = Date.now();

      db.insert(systemStructureEntityTypes)
        .values({
          id: typeId,
          systemId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();
      db.insert(systemStructureEntities)
        .values([
          {
            id: parentEntityId,
            systemId,
            entityTypeId: typeId,
            sortOrder: 0,
            encryptedData: testBlob(),
            createdAt: now,
            updatedAt: now,
          },
          {
            id: childEntityId,
            systemId,
            entityTypeId: typeId,
            sortOrder: 1,
            encryptedData: testBlob(),
            createdAt: now,
            updatedAt: now,
          },
        ])
        .run();

      db.insert(systemStructureEntityLinks)
        .values({
          id: crypto.randomUUID(),
          systemId,
          entityId: childEntityId,
          parentEntityId,
          sortOrder: 0,
          createdAt: now,
        })
        .run();

      expect(() =>
        db
          .insert(systemStructureEntityLinks)
          .values({
            id: crypto.randomUUID(),
            systemId,
            entityId: childEntityId,
            parentEntityId,
            sortOrder: 1,
            createdAt: now,
          })
          .run(),
      ).toThrow(/UNIQUE|constraint/i);
    });

    it("enforces unique entityId at root (parentEntityId = null)", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const typeId = crypto.randomUUID();
      const entityId = crypto.randomUUID();
      const now = Date.now();

      db.insert(systemStructureEntityTypes)
        .values({
          id: typeId,
          systemId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();
      db.insert(systemStructureEntities)
        .values({
          id: entityId,
          systemId,
          entityTypeId: typeId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.insert(systemStructureEntityLinks)
        .values({ id: crypto.randomUUID(), systemId, entityId, sortOrder: 0, createdAt: now })
        .run();

      expect(() =>
        db
          .insert(systemStructureEntityLinks)
          .values({ id: crypto.randomUUID(), systemId, entityId, sortOrder: 1, createdAt: now })
          .run(),
      ).toThrow(/UNIQUE|constraint/i);
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const typeId = crypto.randomUUID();
      const entityId = crypto.randomUUID();
      const linkId = crypto.randomUUID();
      const now = Date.now();

      db.insert(systemStructureEntityTypes)
        .values({
          id: typeId,
          systemId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();
      db.insert(systemStructureEntities)
        .values({
          id: entityId,
          systemId,
          entityTypeId: typeId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();
      db.insert(systemStructureEntityLinks)
        .values({ id: linkId, systemId, entityId, sortOrder: 0, createdAt: now })
        .run();

      client.prepare("DELETE FROM systems WHERE id = ?").run(systemId);
      const rows = client
        .prepare("SELECT * FROM system_structure_entity_links WHERE id = ?")
        .all(linkId);
      expect(rows).toHaveLength(0);
    });
  });

  // ── Structure Entity Member Links ──────────────────────────────────

  describe("systemStructureEntityMemberLinks", () => {
    it("inserts and round-trips data", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const typeId = crypto.randomUUID();
      const entityId = crypto.randomUUID();
      const now = Date.now();

      db.insert(systemStructureEntityTypes)
        .values({
          id: typeId,
          systemId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();
      db.insert(systemStructureEntities)
        .values({
          id: entityId,
          systemId,
          entityTypeId: typeId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const linkId = crypto.randomUUID();
      db.insert(systemStructureEntityMemberLinks)
        .values({
          id: linkId,
          systemId,
          parentEntityId: entityId,
          memberId,
          sortOrder: 0,
          createdAt: now,
        })
        .run();

      const rows = db
        .select()
        .from(systemStructureEntityMemberLinks)
        .where(eq(systemStructureEntityMemberLinks.id, linkId))
        .all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.memberId).toBe(memberId);
      expect(rows[0]?.parentEntityId).toBe(entityId);
    });

    it("rejects nonexistent memberId FK (RESTRICT)", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        db
          .insert(systemStructureEntityMemberLinks)
          .values({
            id: crypto.randomUUID(),
            systemId,
            memberId: "nonexistent",
            sortOrder: 0,
            createdAt: now,
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("prevents deletion of member with dependent links (RESTRICT)", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const now = Date.now();

      db.insert(systemStructureEntityMemberLinks)
        .values({
          id: crypto.randomUUID(),
          systemId,
          memberId,
          sortOrder: 0,
          createdAt: now,
        })
        .run();

      expect(() => db.delete(members).where(eq(members.id, memberId)).run()).toThrow(
        /FOREIGN KEY|constraint/i,
      );
    });

    it("enforces unique (memberId, parentEntityId)", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const typeId = crypto.randomUUID();
      const entityId = crypto.randomUUID();
      const now = Date.now();

      db.insert(systemStructureEntityTypes)
        .values({
          id: typeId,
          systemId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();
      db.insert(systemStructureEntities)
        .values({
          id: entityId,
          systemId,
          entityTypeId: typeId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.insert(systemStructureEntityMemberLinks)
        .values({
          id: crypto.randomUUID(),
          systemId,
          memberId,
          parentEntityId: entityId,
          sortOrder: 0,
          createdAt: now,
        })
        .run();

      expect(() =>
        db
          .insert(systemStructureEntityMemberLinks)
          .values({
            id: crypto.randomUUID(),
            systemId,
            memberId,
            parentEntityId: entityId,
            sortOrder: 1,
            createdAt: now,
          })
          .run(),
      ).toThrow(/UNIQUE|constraint/i);
    });

    it("enforces unique memberId at root (parentEntityId = null)", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const now = Date.now();

      db.insert(systemStructureEntityMemberLinks)
        .values({
          id: crypto.randomUUID(),
          systemId,
          memberId,
          sortOrder: 0,
          createdAt: now,
        })
        .run();

      expect(() =>
        db
          .insert(systemStructureEntityMemberLinks)
          .values({
            id: crypto.randomUUID(),
            systemId,
            memberId,
            sortOrder: 1,
            createdAt: now,
          })
          .run(),
      ).toThrow(/UNIQUE|constraint/i);
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const linkId = crypto.randomUUID();
      const now = Date.now();

      db.insert(systemStructureEntityMemberLinks)
        .values({
          id: linkId,
          systemId,
          memberId,
          sortOrder: 0,
          createdAt: now,
        })
        .run();

      client.prepare("DELETE FROM systems WHERE id = ?").run(systemId);
      const rows = client
        .prepare("SELECT * FROM system_structure_entity_member_links WHERE id = ?")
        .all(linkId);
      expect(rows).toHaveLength(0);
    });

    it("rejects nonexistent parentEntityId FK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const now = Date.now();

      expect(() =>
        db
          .insert(systemStructureEntityMemberLinks)
          .values({
            id: crypto.randomUUID(),
            systemId,
            memberId,
            parentEntityId: "nonexistent",
            sortOrder: 0,
            createdAt: now,
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });
  });

  // ── Structure Entity Associations ──────────────────────────────────

  describe("systemStructureEntityAssociations", () => {
    it("inserts and round-trips data", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const typeId = crypto.randomUUID();
      const entityId1 = crypto.randomUUID();
      const entityId2 = crypto.randomUUID();
      const now = Date.now();

      db.insert(systemStructureEntityTypes)
        .values({
          id: typeId,
          systemId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();
      db.insert(systemStructureEntities)
        .values([
          {
            id: entityId1,
            systemId,
            entityTypeId: typeId,
            sortOrder: 0,
            encryptedData: testBlob(),
            createdAt: now,
            updatedAt: now,
          },
          {
            id: entityId2,
            systemId,
            entityTypeId: typeId,
            sortOrder: 1,
            encryptedData: testBlob(),
            createdAt: now,
            updatedAt: now,
          },
        ])
        .run();

      const assocId = crypto.randomUUID();
      db.insert(systemStructureEntityAssociations)
        .values({
          id: assocId,
          systemId,
          sourceEntityId: entityId1,
          targetEntityId: entityId2,
          createdAt: now,
        })
        .run();

      const rows = db
        .select()
        .from(systemStructureEntityAssociations)
        .where(eq(systemStructureEntityAssociations.id, assocId))
        .all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.sourceEntityId).toBe(entityId1);
      expect(rows[0]?.targetEntityId).toBe(entityId2);
    });

    it("enforces unique (sourceEntityId, targetEntityId)", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const typeId = crypto.randomUUID();
      const entityId1 = crypto.randomUUID();
      const entityId2 = crypto.randomUUID();
      const now = Date.now();

      db.insert(systemStructureEntityTypes)
        .values({
          id: typeId,
          systemId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();
      db.insert(systemStructureEntities)
        .values([
          {
            id: entityId1,
            systemId,
            entityTypeId: typeId,
            sortOrder: 0,
            encryptedData: testBlob(),
            createdAt: now,
            updatedAt: now,
          },
          {
            id: entityId2,
            systemId,
            entityTypeId: typeId,
            sortOrder: 1,
            encryptedData: testBlob(),
            createdAt: now,
            updatedAt: now,
          },
        ])
        .run();

      db.insert(systemStructureEntityAssociations)
        .values({
          id: crypto.randomUUID(),
          systemId,
          sourceEntityId: entityId1,
          targetEntityId: entityId2,
          createdAt: now,
        })
        .run();

      expect(() =>
        db
          .insert(systemStructureEntityAssociations)
          .values({
            id: crypto.randomUUID(),
            systemId,
            sourceEntityId: entityId1,
            targetEntityId: entityId2,
            createdAt: now,
          })
          .run(),
      ).toThrow(/UNIQUE|constraint/i);
    });

    it("prevents deletion of entity with dependent associations (RESTRICT)", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const typeId = crypto.randomUUID();
      const entityId1 = crypto.randomUUID();
      const entityId2 = crypto.randomUUID();
      const now = Date.now();

      db.insert(systemStructureEntityTypes)
        .values({
          id: typeId,
          systemId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();
      db.insert(systemStructureEntities)
        .values([
          {
            id: entityId1,
            systemId,
            entityTypeId: typeId,
            sortOrder: 0,
            encryptedData: testBlob(),
            createdAt: now,
            updatedAt: now,
          },
          {
            id: entityId2,
            systemId,
            entityTypeId: typeId,
            sortOrder: 1,
            encryptedData: testBlob(),
            createdAt: now,
            updatedAt: now,
          },
        ])
        .run();
      db.insert(systemStructureEntityAssociations)
        .values({
          id: crypto.randomUUID(),
          systemId,
          sourceEntityId: entityId1,
          targetEntityId: entityId2,
          createdAt: now,
        })
        .run();

      expect(() =>
        db.delete(systemStructureEntities).where(eq(systemStructureEntities.id, entityId1)).run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const typeId = crypto.randomUUID();
      const entityId1 = crypto.randomUUID();
      const entityId2 = crypto.randomUUID();
      const assocId = crypto.randomUUID();
      const now = Date.now();

      db.insert(systemStructureEntityTypes)
        .values({
          id: typeId,
          systemId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();
      db.insert(systemStructureEntities)
        .values([
          {
            id: entityId1,
            systemId,
            entityTypeId: typeId,
            sortOrder: 0,
            encryptedData: testBlob(),
            createdAt: now,
            updatedAt: now,
          },
          {
            id: entityId2,
            systemId,
            entityTypeId: typeId,
            sortOrder: 1,
            encryptedData: testBlob(),
            createdAt: now,
            updatedAt: now,
          },
        ])
        .run();
      db.insert(systemStructureEntityAssociations)
        .values({
          id: assocId,
          systemId,
          sourceEntityId: entityId1,
          targetEntityId: entityId2,
          createdAt: now,
        })
        .run();

      client.prepare("DELETE FROM systems WHERE id = ?").run(systemId);
      const rows = client
        .prepare("SELECT * FROM system_structure_entity_associations WHERE id = ?")
        .all(assocId);
      expect(rows).toHaveLength(0);
    });

    it("rejects self-referential association", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const typeId = crypto.randomUUID();
      const entityId = crypto.randomUUID();
      const now = Date.now();

      db.insert(systemStructureEntityTypes)
        .values({
          id: typeId,
          systemId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();
      db.insert(systemStructureEntities)
        .values({
          id: entityId,
          systemId,
          entityTypeId: typeId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      expect(() =>
        client
          .prepare(
            `INSERT INTO system_structure_entity_associations (id, system_id, source_entity_id, target_entity_id, created_at)
             VALUES (?, ?, ?, ?, ?)`,
          )
          .run(crypto.randomUUID(), systemId, entityId, entityId, now),
      ).toThrow(/check|constraint/i);
    });
  });
});
