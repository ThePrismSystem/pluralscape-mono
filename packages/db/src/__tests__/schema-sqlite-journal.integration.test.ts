import { brandId } from "@pluralscape/types";
import Database from "better-sqlite3-multiple-ciphers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/sqlite/auth.js";
import { frontingSessions } from "../schema/sqlite/fronting.js";
import { journalEntries, wikiPages } from "../schema/sqlite/journal.js";
import { members } from "../schema/sqlite/members.js";
import { systems } from "../schema/sqlite/systems.js";

import {
  createSqliteJournalTables,
  sqliteInsertAccount,
  sqliteInsertMember,
  sqliteInsertSystem,
  testBlob,
} from "./helpers/sqlite-helpers.js";

import type { FrontingSessionId, JournalEntryId, SlugHash, WikiPageId } from "@pluralscape/types";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = { accounts, systems, members, frontingSessions, journalEntries, wikiPages };

describe("SQLite journal schema", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  const insertAccount = (id?: string) => sqliteInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string) => sqliteInsertSystem(db, accountId, id);
  const insertMember = (systemId: string, id?: string): string =>
    sqliteInsertMember(db, systemId, id);

  beforeAll(() => {
    client = new Database(":memory:");
    client.pragma("foreign_keys = ON");
    db = drizzle(client, { schema });
    createSqliteJournalTables(client);
  });

  afterAll(() => {
    client.close();
  });

  afterEach(() => {
    db.delete(journalEntries).run();
    db.delete(wikiPages).run();
  });

  describe("journal_entries", () => {
    it("round-trips with encrypted_data and frontingSessionId", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const fsId = brandId<FrontingSessionId>(crypto.randomUUID());
      const id = brandId<JournalEntryId>(crypto.randomUUID());
      const now = Date.now();
      const data = testBlob(new Uint8Array([10, 20, 30]));

      db.insert(frontingSessions)
        .values({
          id: fsId,
          systemId,
          memberId,
          startTime: now,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.insert(journalEntries)
        .values({
          id,
          systemId,
          frontingSessionId: fsId,
          encryptedData: data,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(journalEntries).where(eq(journalEntries.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.frontingSessionId).toBe(fsId);
      expect(rows[0]).not.toHaveProperty("author");
    });

    it("allows nullable frontingSessionId", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = brandId<JournalEntryId>(crypto.randomUUID());
      const now = Date.now();

      db.insert(journalEntries)
        .values({
          id,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(journalEntries).where(eq(journalEntries.id, id)).all();
      expect(rows[0]?.frontingSessionId).toBeNull();
    });

    it("defaults archived to false and version to 1", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = brandId<JournalEntryId>(crypto.randomUUID());
      const now = Date.now();

      db.insert(journalEntries)
        .values({
          id,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
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
      const id = brandId<JournalEntryId>(crypto.randomUUID());
      const now = Date.now();

      db.insert(journalEntries)
        .values({
          id,
          systemId,
          archived: true,
          archivedAt: now,
          encryptedData: testBlob(new Uint8Array([1])),
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
      const id = brandId<JournalEntryId>(crypto.randomUUID());
      const now = Date.now();

      db.insert(journalEntries)
        .values({
          id,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.delete(systems).where(eq(systems.id, systemId)).run();
      const rows = db.select().from(journalEntries).where(eq(journalEntries.id, id)).all();
      expect(rows).toHaveLength(0);
    });

    it("rejects archived=true with archivedAt=null via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            "INSERT INTO journal_entries (id, system_id, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES (?, ?, X'0102', ?, ?, 1, 1, NULL)",
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
            "INSERT INTO journal_entries (id, system_id, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES (?, ?, X'0102', ?, ?, 1, 0, ?)",
          )
          .run(crypto.randomUUID(), systemId, now, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("updates archived from false to true", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = brandId<JournalEntryId>(crypto.randomUUID());
      const now = Date.now();

      db.insert(journalEntries)
        .values({
          id,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.update(journalEntries)
        .set({ archived: true, archivedAt: now })
        .where(eq(journalEntries.id, id))
        .run();

      const rows = db.select().from(journalEntries).where(eq(journalEntries.id, id)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });
  });

  describe("wiki_pages", () => {
    it("round-trips with encrypted_data and slugHash", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = brandId<WikiPageId>(crypto.randomUUID());
      const now = Date.now();
      const data = testBlob(new Uint8Array([10, 20, 30]));
      const hash = brandId<SlugHash>("a".repeat(64));

      db.insert(wikiPages)
        .values({
          id,
          systemId,
          slugHash: brandId<SlugHash>(hash),
          encryptedData: data,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(wikiPages).where(eq(wikiPages.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.slugHash).toBe(hash);
    });

    it("defaults archived to false and version to 1", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = brandId<WikiPageId>(crypto.randomUUID());
      const now = Date.now();

      db.insert(wikiPages)
        .values({
          id,
          systemId,
          slugHash: brandId<SlugHash>("a".repeat(64)),
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(wikiPages).where(eq(wikiPages.id, id)).all();
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
      expect(rows[0]?.version).toBe(1);
    });

    it("enforces unique (system_id, slug_hash)", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const slugHash = brandId<SlugHash>("b".repeat(64));
      const now = Date.now();

      db.insert(wikiPages)
        .values({
          id: brandId<WikiPageId>(crypto.randomUUID()),
          systemId,
          slugHash,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      expect(() =>
        db
          .insert(wikiPages)
          .values({
            id: brandId<WikiPageId>(crypto.randomUUID()),
            systemId,
            slugHash,
            encryptedData: testBlob(new Uint8Array([2])),
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow();
    });

    it("allows same slugHash in different systems", () => {
      const accountId = insertAccount();
      const systemId1 = insertSystem(accountId);
      const systemId2 = insertSystem(accountId);
      const slugHash = brandId<SlugHash>("c".repeat(64));
      const now = Date.now();

      db.insert(wikiPages)
        .values({
          id: brandId<WikiPageId>(crypto.randomUUID()),
          systemId: systemId1,
          slugHash,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.insert(wikiPages)
        .values({
          id: brandId<WikiPageId>(crypto.randomUUID()),
          systemId: systemId2,
          slugHash,
          encryptedData: testBlob(new Uint8Array([2])),
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
      const id = brandId<WikiPageId>(crypto.randomUUID());
      const now = Date.now();

      db.insert(wikiPages)
        .values({
          id,
          systemId,
          slugHash: brandId<SlugHash>("d".repeat(64)),
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.delete(systems).where(eq(systems.id, systemId)).run();
      const rows = db.select().from(wikiPages).where(eq(wikiPages.id, id)).all();
      expect(rows).toHaveLength(0);
    });

    it("rejects archived=true with archivedAt=null via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            "INSERT INTO wiki_pages (id, system_id, slug_hash, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES (?, ?, ?, X'0102', ?, ?, 1, 1, NULL)",
          )
          .run(crypto.randomUUID(), systemId, "e".repeat(64), now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("rejects archived=false with archivedAt set via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            "INSERT INTO wiki_pages (id, system_id, slug_hash, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES (?, ?, ?, X'0102', ?, ?, 1, 0, ?)",
          )
          .run(crypto.randomUUID(), systemId, "f".repeat(64), now, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("updates archived from false to true", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = brandId<WikiPageId>(crypto.randomUUID());
      const now = Date.now();

      db.insert(wikiPages)
        .values({
          id,
          systemId,
          slugHash: brandId<SlugHash>("g".repeat(64)),
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.update(wikiPages)
        .set({ archived: true, archivedAt: now })
        .where(eq(wikiPages.id, id))
        .run();

      const rows = db.select().from(wikiPages).where(eq(wikiPages.id, id)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("rejects slug_hash shorter than 64 chars", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        db
          .insert(wikiPages)
          .values({
            id: brandId<WikiPageId>(crypto.randomUUID()),
            systemId,
            slugHash: brandId<SlugHash>("a".repeat(32)),
            encryptedData: testBlob(new Uint8Array([1])),
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow(/CHECK|constraint/i);
    });

    it("allows duplicate (systemId, slugHash) when both rows are archived", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const slugHash = brandId<SlugHash>("h".repeat(64));
      const now = Date.now();

      db.insert(wikiPages)
        .values({
          id: brandId<WikiPageId>(crypto.randomUUID()),
          systemId,
          slugHash,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
          archived: true,
          archivedAt: now,
        })
        .run();

      db.insert(wikiPages)
        .values({
          id: brandId<WikiPageId>(crypto.randomUUID()),
          systemId,
          slugHash,
          encryptedData: testBlob(new Uint8Array([2])),
          createdAt: now,
          updatedAt: now,
          archived: true,
          archivedAt: now,
        })
        .run();

      const rows = db.select().from(wikiPages).where(eq(wikiPages.systemId, systemId)).all();
      expect(rows.filter((r) => r.slugHash === slugHash)).toHaveLength(2);
    });

    it("rejects duplicate (systemId, slugHash) when both rows are active", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const slugHash = brandId<SlugHash>("i".repeat(64));
      const now = Date.now();

      db.insert(wikiPages)
        .values({
          id: brandId<WikiPageId>(crypto.randomUUID()),
          systemId,
          slugHash,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      expect(() =>
        db
          .insert(wikiPages)
          .values({
            id: brandId<WikiPageId>(crypto.randomUUID()),
            systemId,
            slugHash,
            encryptedData: testBlob(new Uint8Array([2])),
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow();
    });
  });
});
