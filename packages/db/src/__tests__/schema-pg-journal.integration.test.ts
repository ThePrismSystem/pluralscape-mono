import { PGlite } from "@electric-sql/pglite";
import { brandId } from "@pluralscape/types";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/pg/auth.js";
import { frontingSessions } from "../schema/pg/fronting.js";
import { journalEntries, wikiPages } from "../schema/pg/journal.js";
import { systems } from "../schema/pg/systems.js";

import {
  createPgJournalTables,
  pgInsertAccount,
  pgInsertMember,
  pgInsertSystem,
  testBlob,
} from "./helpers/pg-helpers.js";

import type { FrontingSessionId } from "@pluralscape/types";
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

  afterEach(async () => {
    await db.delete(wikiPages);
    await db.delete(journalEntries);
  });

  describe("journal_entries", () => {
    it("round-trips with encrypted_data and frontingSessionId", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const fsId = brandId<FrontingSessionId>(crypto.randomUUID());
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = testBlob(new Uint8Array([10, 20, 30]));

      const memberId = await pgInsertMember(db, systemId);
      await db.insert(frontingSessions).values({
        id: fsId,
        systemId,
        startTime: now,
        memberId,
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

    it("updates archived from false to true", async () => {
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

      const archiveTime = Date.now();
      await db
        .update(journalEntries)
        .set({ archived: true, archivedAt: archiveTime })
        .where(eq(journalEntries.id, id));

      const rows = await db.select().from(journalEntries).where(eq(journalEntries.id, id));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(archiveTime);
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

    it("rejects archived=true with archivedAt=null via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await expect(
        client.query(
          "INSERT INTO journal_entries (id, system_id, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES ($1, $2, '\\x0102'::bytea, $3, $4, 1, true, NULL)",
          [crypto.randomUUID(), systemId, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });

    it("rejects archived=false with archivedAt set via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await expect(
        client.query(
          "INSERT INTO journal_entries (id, system_id, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES ($1, $2, '\\x0102'::bytea, $3, $4, 1, false, $5)",
          [crypto.randomUUID(), systemId, now, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });
  });

  describe("wiki_pages", () => {
    it("round-trips with encrypted_data and slugHash", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = testBlob(new Uint8Array([10, 20, 30]));
      const hash = "a".repeat(64);

      await db.insert(wikiPages).values({
        id,
        systemId,
        slugHash: hash,
        encryptedData: data,
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(wikiPages).where(eq(wikiPages.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.slugHash).toBe(hash);
    });

    it("defaults archived to false and version to 1", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(wikiPages).values({
        id,
        systemId,
        slugHash: "a".repeat(64),
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(wikiPages).where(eq(wikiPages.id, id));
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
      expect(rows[0]?.version).toBe(1);
    });

    it("updates archived from false to true", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(wikiPages).values({
        id,
        systemId,
        slugHash: "g".repeat(64),
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const archiveTime = Date.now();
      await db
        .update(wikiPages)
        .set({ archived: true, archivedAt: archiveTime })
        .where(eq(wikiPages.id, id));

      const rows = await db.select().from(wikiPages).where(eq(wikiPages.id, id));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(archiveTime);
    });

    it("enforces unique (system_id, slug_hash)", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const slugHash = "b".repeat(64);
      const now = Date.now();

      await db.insert(wikiPages).values({
        id: crypto.randomUUID(),
        systemId,
        slugHash,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        db.insert(wikiPages).values({
          id: crypto.randomUUID(),
          systemId,
          slugHash,
          encryptedData: testBlob(new Uint8Array([2])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("allows same slugHash in different systems", async () => {
      const accountId = await insertAccount();
      const systemId1 = await insertSystem(accountId);
      const systemId2 = await insertSystem(accountId);
      const slugHash = "c".repeat(64);
      const now = Date.now();

      await db.insert(wikiPages).values({
        id: crypto.randomUUID(),
        systemId: systemId1,
        slugHash,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(wikiPages).values({
        id: crypto.randomUUID(),
        systemId: systemId2,
        slugHash,
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
        slugHash: "d".repeat(64),
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db.select().from(wikiPages).where(eq(wikiPages.id, id));
      expect(rows).toHaveLength(0);
    });

    it("rejects archived=true with archivedAt=null via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await expect(
        client.query(
          "INSERT INTO wiki_pages (id, system_id, slug_hash, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES ($1, $2, $3, '\\x0102'::bytea, $4, $5, 1, true, NULL)",
          [crypto.randomUUID(), systemId, "e".repeat(64), now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });

    it("rejects archived=false with archivedAt set via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await expect(
        client.query(
          "INSERT INTO wiki_pages (id, system_id, slug_hash, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES ($1, $2, $3, '\\x0102'::bytea, $4, $5, 1, false, $6)",
          [crypto.randomUUID(), systemId, "f".repeat(64), now, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });

    it("rejects slug_hash shorter than 64 chars", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await expect(
        db.insert(wikiPages).values({
          id: crypto.randomUUID(),
          systemId,
          slugHash: "a".repeat(32),
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("allows duplicate (systemId, slugHash) when both rows are archived", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const slugHash = "h".repeat(64);
      const now = Date.now();

      await db.insert(wikiPages).values({
        id: crypto.randomUUID(),
        systemId,
        slugHash,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
        archived: true,
        archivedAt: now,
      });

      await db.insert(wikiPages).values({
        id: crypto.randomUUID(),
        systemId,
        slugHash,
        encryptedData: testBlob(new Uint8Array([2])),
        createdAt: now,
        updatedAt: now,
        archived: true,
        archivedAt: now,
      });

      const rows = await db.select().from(wikiPages).where(eq(wikiPages.systemId, systemId));
      expect(rows.filter((r) => r.slugHash === slugHash)).toHaveLength(2);
    });

    it("rejects duplicate (systemId, slugHash) when both rows are active", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const slugHash = "i".repeat(64);
      const now = Date.now();

      await db.insert(wikiPages).values({
        id: crypto.randomUUID(),
        systemId,
        slugHash,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        db.insert(wikiPages).values({
          id: crypto.randomUUID(),
          systemId,
          slugHash,
          encryptedData: testBlob(new Uint8Array([2])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });
  });
});
