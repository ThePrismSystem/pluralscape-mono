import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/pg/auth.js";
import { frontingSessions } from "../schema/pg/fronting.js";
import { journalEntries, wikiPages } from "../schema/pg/journal.js";
import { systems } from "../schema/pg/systems.js";

import {
  createPgJournalTables,
  pgInsertAccount,
  pgInsertSystem,
  testBlob,
} from "./helpers/pg-helpers.js";

import type { PgliteDatabase } from "drizzle-orm/pglite";

const schema = { accounts, systems, frontingSessions, journalEntries, wikiPages };

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
    it("round-trips with encrypted_data and frontingSessionId", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const fsId = crypto.randomUUID();
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = testBlob(new Uint8Array([10, 20, 30]));

      await db.insert(frontingSessions).values({
        id: fsId,
        systemId,
        startTime: now,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(journalEntries).values({
        id,
        systemId,
        frontingSessionId: fsId,
        encryptedData: data,
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(journalEntries).where(eq(journalEntries.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.frontingSessionId).toBe(fsId);
      expect(rows[0]).not.toHaveProperty("author");
    });

    it("allows nullable frontingSessionId", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(journalEntries).values({
        id,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(journalEntries).where(eq(journalEntries.id, id));
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
        encryptedData: testBlob(new Uint8Array([1])),
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
        encryptedData: testBlob(new Uint8Array([1])),
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
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db.select().from(journalEntries).where(eq(journalEntries.id, id));
      expect(rows).toHaveLength(0);
    });
  });

  describe("wiki_pages", () => {
    it("round-trips with encrypted_data and slug", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = testBlob(new Uint8Array([10, 20, 30]));

      await db.insert(wikiPages).values({
        id,
        systemId,
        slug: "test-page",
        encryptedData: data,
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(wikiPages).where(eq(wikiPages.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.slug).toBe("test-page");
    });

    it("defaults archived to false and version to 1", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(wikiPages).values({
        id,
        systemId,
        slug: `slug-${crypto.randomUUID()}`,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(wikiPages).where(eq(wikiPages.id, id));
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
      expect(rows[0]?.version).toBe(1);
    });

    it("enforces unique (system_id, slug)", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const slug = `unique-${crypto.randomUUID()}`;
      const now = Date.now();

      await db.insert(wikiPages).values({
        id: crypto.randomUUID(),
        systemId,
        slug,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        db.insert(wikiPages).values({
          id: crypto.randomUUID(),
          systemId,
          slug,
          encryptedData: testBlob(new Uint8Array([2])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("allows same slug in different systems", async () => {
      const accountId = await insertAccount();
      const systemId1 = await insertSystem(accountId);
      const systemId2 = await insertSystem(accountId);
      const slug = `shared-${crypto.randomUUID()}`;
      const now = Date.now();

      await db.insert(wikiPages).values({
        id: crypto.randomUUID(),
        systemId: systemId1,
        slug,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(wikiPages).values({
        id: crypto.randomUUID(),
        systemId: systemId2,
        slug,
        encryptedData: testBlob(new Uint8Array([2])),
        createdAt: now,
        updatedAt: now,
      });

      const rows1 = await db.select().from(wikiPages).where(eq(wikiPages.systemId, systemId1));
      const rows2 = await db.select().from(wikiPages).where(eq(wikiPages.systemId, systemId2));
      expect(rows1).toHaveLength(1);
      expect(rows2).toHaveLength(1);
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(wikiPages).values({
        id,
        systemId,
        slug: `del-${crypto.randomUUID()}`,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db.select().from(wikiPages).where(eq(wikiPages.id, id));
      expect(rows).toHaveLength(0);
    });
  });
});
