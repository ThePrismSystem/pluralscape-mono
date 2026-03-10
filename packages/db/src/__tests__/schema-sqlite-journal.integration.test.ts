import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/sqlite/auth.js";
import { journalEntries, wikiPages } from "../schema/sqlite/journal.js";
import { systems } from "../schema/sqlite/systems.js";

import {
  createSqliteJournalTables,
  sqliteInsertAccount,
  sqliteInsertSystem,
} from "./helpers/sqlite-helpers.js";

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = { accounts, systems, journalEntries, wikiPages };

describe("SQLite journal schema", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  const insertAccount = (id?: string): string => sqliteInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string): string =>
    sqliteInsertSystem(db, accountId, id);

  beforeAll(() => {
    client = new Database(":memory:");
    client.pragma("foreign_keys = ON");
    db = drizzle(client, { schema });
    createSqliteJournalTables(client);
  });

  afterAll(() => {
    client.close();
  });

  describe("journal_entries", () => {
    it("round-trips with encrypted_data and author JSON", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = new Uint8Array([10, 20, 30]);
      const author = { type: "member", id: "member-1" };

      db.insert(journalEntries)
        .values({
          id,
          systemId,
          author,
          frontingSessionId: "fs-123",
          encryptedData: data,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(journalEntries).where(eq(journalEntries.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.author).toEqual(author);
      expect(rows[0]?.frontingSessionId).toBe("fs-123");
    });

    it("allows nullable author and frontingSessionId", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(journalEntries)
        .values({
          id,
          systemId,
          encryptedData: new Uint8Array([1]),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(journalEntries).where(eq(journalEntries.id, id)).all();
      expect(rows[0]?.author).toBeNull();
      expect(rows[0]?.frontingSessionId).toBeNull();
    });

    it("defaults archived to false and version to 1", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(journalEntries)
        .values({
          id,
          systemId,
          encryptedData: new Uint8Array([1]),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(journalEntries).where(eq(journalEntries.id, id)).all();
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
      expect(rows[0]?.version).toBe(1);
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(journalEntries)
        .values({
          id,
          systemId,
          encryptedData: new Uint8Array([1]),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.delete(systems).where(eq(systems.id, systemId)).run();
      const rows = db.select().from(journalEntries).where(eq(journalEntries.id, id)).all();
      expect(rows).toHaveLength(0);
    });
  });

  describe("wiki_pages", () => {
    it("round-trips with encrypted_data", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = new Uint8Array([10, 20, 30]);

      db.insert(wikiPages)
        .values({
          id,
          systemId,
          encryptedData: data,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(wikiPages).where(eq(wikiPages.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
    });

    it("defaults archived to false and version to 1", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(wikiPages)
        .values({
          id,
          systemId,
          encryptedData: new Uint8Array([1]),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(wikiPages).where(eq(wikiPages.id, id)).all();
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
      expect(rows[0]?.version).toBe(1);
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(wikiPages)
        .values({
          id,
          systemId,
          encryptedData: new Uint8Array([1]),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.delete(systems).where(eq(systems.id, systemId)).run();
      const rows = db.select().from(wikiPages).where(eq(wikiPages.id, id)).all();
      expect(rows).toHaveLength(0);
    });
  });
});
