import Database from "better-sqlite3";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/sqlite/auth.js";
import { members, memberPhotos } from "../schema/sqlite/members.js";
import { systems } from "../schema/sqlite/systems.js";

import { createSqliteMemberTables } from "./helpers/sqlite-helpers.js";

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
    createSqliteMemberTables(client);
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

    it("rejects nonexistent systemId FK", () => {
      const now = Date.now();
      expect(() =>
        db
          .insert(members)
          .values({
            id: crypto.randomUUID(),
            systemId: "nonexistent",
            encryptedData: new Uint8Array([1]),
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("round-trips empty Uint8Array for encrypted_data", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(members)
        .values({
          id,
          systemId,
          encryptedData: new Uint8Array(0),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(members).where(eq(members.id, id)).all();
      expect(rows[0]?.encryptedData).toEqual(new Uint8Array(0));
    });

    it("round-trips archived: true with archivedAt timestamp", () => {
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
          archived: true,
          archivedAt: now,
        })
        .run();

      const rows = db.select().from(members).where(eq(members.id, id)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("updates version and updatedAt correctly", () => {
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

      const later = now + 1000;
      db.update(members)
        .set({ version: sql`${members.version} + 1`, updatedAt: later })
        .where(eq(members.id, id))
        .run();

      const rows = db.select().from(members).where(eq(members.id, id)).all();
      expect(rows[0]?.version).toBe(2);
      expect(rows[0]?.updatedAt).toBe(later);
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

    it("defaults version to 1", () => {
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
      expect(rows[0]?.version).toBe(1);
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

    it("rejects nonexistent memberId FK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        db
          .insert(memberPhotos)
          .values({
            id: crypto.randomUUID(),
            memberId: "nonexistent",
            systemId,
            encryptedData: new Uint8Array([1]),
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("rejects nonexistent systemId FK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const now = Date.now();

      expect(() =>
        db
          .insert(memberPhotos)
          .values({
            id: crypto.randomUUID(),
            memberId,
            systemId: "nonexistent",
            encryptedData: new Uint8Array([1]),
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });
  });
});
