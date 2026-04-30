/**
 * SQLite structure schema — relationships table.
 *
 * Covers: relationships (17 tests).
 *
 * Source: schema-sqlite-structure.integration.test.ts (lines 95-444)
 */

import { brandId } from "@pluralscape/types";
import Database from "better-sqlite3-multiple-ciphers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/sqlite/auth.js";
import { members } from "../schema/sqlite/members.js";
import { relationships } from "../schema/sqlite/structure.js";
import { systems } from "../schema/sqlite/systems.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import {
  createSqliteStructureTables,
  sqliteInsertAccount,
  sqliteInsertMember,
  sqliteInsertSystem,
  testBlob,
} from "./helpers/sqlite-helpers.js";

import type { MemberId, RelationshipId, SystemId } from "@pluralscape/types";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = { accounts, systems, members, relationships };

describe("SQLite structure schema — relationships", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  const insertAccount = (id?: string) => sqliteInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string): SystemId =>
    sqliteInsertSystem(db, accountId, id);
  const insertMember = (systemId: string, id?: string): MemberId =>
    brandId<MemberId>(sqliteInsertMember(db, systemId, id));
  const newRelId = (): RelationshipId => brandId<RelationshipId>(crypto.randomUUID());

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
    db.delete(relationships).run();
  });

  describe("relationships", () => {
    it("inserts and round-trips encrypted data", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = newRelId();
      const now = fixtureNow();
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
      const id = newRelId();
      const now = fixtureNow();

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
      const id = newRelId();
      const now = fixtureNow();

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
      const now = fixtureNow();
      expect(() =>
        db
          .insert(relationships)
          .values({
            id: brandId<RelationshipId>(crypto.randomUUID()),
            systemId: brandId<SystemId>("nonexistent"),
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
      const id = newRelId();
      const now = fixtureNow();

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
      const id = newRelId();
      const now = fixtureNow();

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
      const now = fixtureNow();

      expect(() =>
        db
          .insert(relationships)
          .values({
            id: brandId<RelationshipId>(crypto.randomUUID()),
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
      const id = newRelId();
      const now = fixtureNow();

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
      const now = fixtureNow();

      expect(() =>
        db
          .insert(relationships)
          .values({
            id: brandId<RelationshipId>(crypto.randomUUID()),
            systemId,
            type: "sibling",
            sourceMemberId: brandId<MemberId>("nonexistent"),
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
      const id = newRelId();
      const now = fixtureNow();

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
      const now = fixtureNow();

      expect(() =>
        db
          .insert(relationships)
          .values({
            id: brandId<RelationshipId>(crypto.randomUUID()),
            systemId,
            type: "sibling",
            targetMemberId: brandId<MemberId>("nonexistent"),
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
      const id = newRelId();
      const now = fixtureNow();

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
      const id = newRelId();
      const now = fixtureNow();

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
      const now = fixtureNow();

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
      const now = fixtureNow();

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
      const id = newRelId();
      const now = fixtureNow();

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
});
