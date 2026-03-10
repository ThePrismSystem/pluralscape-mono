import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/pg/auth.js";
import { journalEntries, wikiPages } from "../schema/pg/journal.js";
import { systems } from "../schema/pg/systems.js";

import { createPgJournalTables, pgInsertAccount, pgInsertSystem } from "./helpers/pg-helpers.js";

import type { PgliteDatabase } from "drizzle-orm/pglite";

const schema = { accounts, systems, journalEntries, wikiPages };

describe("PG journal schema", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;

  const insertAccount = (id?: string) => pgInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string) => pgInsertSystem(db, accountId, id);

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgJournalTables(client);
  });

  afterAll(async () => {
    await client.close();
  });

  describe("journal_entries", () => {
    it("round-trips with encrypted_data and author JSON", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = new Uint8Array([10, 20, 30]);
      const author = { type: "member", id: "member-1" };

      await db.insert(journalEntries).values({
        id,
        systemId,
        author,
        frontingSessionId: "fs-123",
        encryptedData: data,
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(journalEntries).where(eq(journalEntries.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.author).toEqual(author);
      expect(rows[0]?.frontingSessionId).toBe("fs-123");
    });

    it("allows nullable author and frontingSessionId", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(journalEntries).values({
        id,
        systemId,
        encryptedData: new Uint8Array([1]),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(journalEntries).where(eq(journalEntries.id, id));
      expect(rows[0]?.author).toBeNull();
      expect(rows[0]?.frontingSessionId).toBeNull();
    });

    it("defaults archived to false and version to 1", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(journalEntries).values({
        id,
        systemId,
        encryptedData: new Uint8Array([1]),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(journalEntries).where(eq(journalEntries.id, id));
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
      expect(rows[0]?.version).toBe(1);
    });

    it("round-trips archived state", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(journalEntries).values({
        id,
        systemId,
        archived: true,
        archivedAt: now,
        encryptedData: new Uint8Array([1]),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(journalEntries).where(eq(journalEntries.id, id));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(journalEntries).values({
        id,
        systemId,
        encryptedData: new Uint8Array([1]),
        createdAt: now,
        updatedAt: now,
      });

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db.select().from(journalEntries).where(eq(journalEntries.id, id));
      expect(rows).toHaveLength(0);
    });
  });

  describe("wiki_pages", () => {
    it("round-trips with encrypted_data", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = new Uint8Array([10, 20, 30]);

      await db.insert(wikiPages).values({
        id,
        systemId,
        encryptedData: data,
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(wikiPages).where(eq(wikiPages.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
    });

    it("defaults archived to false and version to 1", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(wikiPages).values({
        id,
        systemId,
        encryptedData: new Uint8Array([1]),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(wikiPages).where(eq(wikiPages.id, id));
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
      expect(rows[0]?.version).toBe(1);
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(wikiPages).values({
        id,
        systemId,
        encryptedData: new Uint8Array([1]),
        createdAt: now,
        updatedAt: now,
      });

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db.select().from(wikiPages).where(eq(wikiPages.id, id));
      expect(rows).toHaveLength(0);
    });
  });
});
