import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/sqlite/auth.js";
import { members, memberPhotos } from "../schema/sqlite/members.js";
import { systems } from "../schema/sqlite/systems.js";

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = { accounts, systems, members, memberPhotos };

describe("SQLite members schema", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  function insertAccount(id = crypto.randomUUID()): string {
    const now = Date.now();
    db.insert(accounts)
      .values({
        id,
        emailHash: `hash_${crypto.randomUUID()}`,
        emailSalt: `salt_${crypto.randomUUID()}`,
        passwordHash: `$argon2id$${crypto.randomUUID()}`,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    return id;
  }

  function insertSystem(accountId: string, id = crypto.randomUUID()): string {
    const now = Date.now();
    db.insert(systems)
      .values({
        id,
        accountId,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    return id;
  }

  function insertMember(systemId: string, id = crypto.randomUUID()): string {
    const now = Date.now();
    db.insert(members)
      .values({
        id,
        systemId,
        encryptedData: new Uint8Array([1, 2, 3]),
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

    client.exec(`
      CREATE TABLE accounts (
        id TEXT PRIMARY KEY,
        email_hash TEXT NOT NULL UNIQUE,
        email_salt TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        version INTEGER NOT NULL DEFAULT 1
      )
    `);

    client.exec(`
      CREATE TABLE systems (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        encrypted_data BLOB,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        version INTEGER NOT NULL DEFAULT 1
      )
    `);

    client.exec(`
      CREATE TABLE members (
        id TEXT PRIMARY KEY,
        system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
        encrypted_data BLOB NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        archived INTEGER NOT NULL DEFAULT 0,
        archived_at INTEGER
      )
    `);

    client.exec(`
      CREATE TABLE member_photos (
        id TEXT PRIMARY KEY,
        member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
        sort_order INTEGER,
        encrypted_data BLOB NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        version INTEGER NOT NULL DEFAULT 1
      )
    `);
  });

  afterAll(() => {
    client.close();
  });

  describe("members", () => {
    it("inserts with encrypted_data and round-trips binary", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = new Uint8Array([10, 20, 30, 40, 50]);

      db.insert(members)
        .values({
          id,
          systemId,
          encryptedData: data,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(members).where(eq(members.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.systemId).toBe(systemId);
    });

    it("defaults archived to false and archivedAt to null", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(members)
        .values({
          id,
          systemId,
          encryptedData: new Uint8Array([1]),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(members).where(eq(members.id, id)).all();
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("defaults version to 1", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(members)
        .values({
          id,
          systemId,
          encryptedData: new Uint8Array([1]),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(members).where(eq(members.id, id)).all();
      expect(rows[0]?.version).toBe(1);
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);

      db.delete(systems).where(eq(systems.id, systemId)).run();
      const rows = db.select().from(members).where(eq(members.id, memberId)).all();
      expect(rows).toHaveLength(0);
    });
  });

  describe("member_photos", () => {
    it("inserts with encrypted_data and sort_order", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = new Uint8Array([100, 200]);

      db.insert(memberPhotos)
        .values({
          id,
          memberId,
          systemId,
          sortOrder: 1,
          encryptedData: data,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(memberPhotos).where(eq(memberPhotos.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.sortOrder).toBe(1);
    });

    it("allows nullable sort_order", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(memberPhotos)
        .values({
          id,
          memberId,
          systemId,
          encryptedData: new Uint8Array([1]),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(memberPhotos).where(eq(memberPhotos.id, id)).all();
      expect(rows[0]?.sortOrder).toBeNull();
    });

    it("cascades on member deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const photoId = crypto.randomUUID();
      const now = Date.now();

      db.insert(memberPhotos)
        .values({
          id: photoId,
          memberId,
          systemId,
          encryptedData: new Uint8Array([1]),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.delete(members).where(eq(members.id, memberId)).run();
      const rows = db.select().from(memberPhotos).where(eq(memberPhotos.id, photoId)).all();
      expect(rows).toHaveLength(0);
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const photoId = crypto.randomUUID();
      const now = Date.now();

      db.insert(memberPhotos)
        .values({
          id: photoId,
          memberId,
          systemId,
          encryptedData: new Uint8Array([1]),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.delete(systems).where(eq(systems.id, systemId)).run();
      const rows = db.select().from(memberPhotos).where(eq(memberPhotos.id, photoId)).all();
      expect(rows).toHaveLength(0);
    });
  });
});
