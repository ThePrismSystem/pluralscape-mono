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
    it("round-trips with encrypted_data", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = new Uint8Array([10, 20, 30]);

      db.insert(journalEntries)
        .values({
          id,
          systemId,
          encryptedData: data,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(journalEntries).where(eq(journalEntries.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
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

    it("round-trips archived state", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(journalEntries)
        .values({
          id,
          systemId,
          archived: true,
          archivedAt: now,
          encryptedData: new Uint8Array([1]),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(journalEntries).where(eq(journalEntries.id, id)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
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
    it("round-trips with encrypted_data and slug", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = new Uint8Array([10, 20, 30]);

      db.insert(wikiPages)
        .values({
          id,
          systemId,
          slug: "test-page",
          encryptedData: data,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(wikiPages).where(eq(wikiPages.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.slug).toBe("test-page");
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
          slug: `slug-${crypto.randomUUID()}`,
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

    it("enforces unique (system_id, slug)", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const slug = `unique-${crypto.randomUUID()}`;
      const now = Date.now();

      db.insert(wikiPages)
        .values({
          id: crypto.randomUUID(),
          systemId,
          slug,
          encryptedData: new Uint8Array([1]),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      expect(() =>
        db
          .insert(wikiPages)
          .values({
            id: crypto.randomUUID(),
            systemId,
            slug,
            encryptedData: new Uint8Array([2]),
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow();
    });

    it("allows same slug in different systems", () => {
      const accountId = insertAccount();
      const systemId1 = insertSystem(accountId);
      const systemId2 = insertSystem(accountId);
      const slug = `shared-${crypto.randomUUID()}`;
      const now = Date.now();

      db.insert(wikiPages)
        .values({
          id: crypto.randomUUID(),
          systemId: systemId1,
          slug,
          encryptedData: new Uint8Array([1]),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.insert(wikiPages)
        .values({
          id: crypto.randomUUID(),
          systemId: systemId2,
          slug,
          encryptedData: new Uint8Array([2]),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows1 = db.select().from(wikiPages).where(eq(wikiPages.systemId, systemId1)).all();
      const rows2 = db.select().from(wikiPages).where(eq(wikiPages.systemId, systemId2)).all();
      expect(rows1).toHaveLength(1);
      expect(rows2).toHaveLength(1);
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
          slug: `del-${crypto.randomUUID()}`,
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
