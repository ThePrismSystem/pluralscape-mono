/**
 * SQLite privacy schema — buckets and bucket_content_tags tables.
 *
 * Covers: buckets (12 tests), bucket_content_tags (6 tests) = 18 tests.
 *
 * Source: schema-sqlite-privacy.integration.test.ts (lines 110–440)
 */

import { brandId } from "@pluralscape/types";
import Database from "better-sqlite3-multiple-ciphers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/sqlite/auth.js";
import { bucketContentTags, buckets } from "../schema/sqlite/privacy.js";
import { systems } from "../schema/sqlite/systems.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import {
  createSqlitePrivacyTables,
  sqliteInsertAccount,
  sqliteInsertSystem,
  testBlob,
  testBlobT2,
} from "./helpers/sqlite-helpers.js";

import type { AccountId, BucketId, SystemId } from "@pluralscape/types";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = { accounts, systems, buckets, bucketContentTags };

describe("SQLite privacy schema — buckets and bucket_content_tags", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  const insertAccount = (id?: string) => sqliteInsertAccount(db, id);
  const insertSystem = (accountId: AccountId, id?: string) => sqliteInsertSystem(db, accountId, id);

  function insertBucket(
    systemId: SystemId,
    id: BucketId = brandId<BucketId>(crypto.randomUUID()),
  ): BucketId {
    const now = fixtureNow();
    db.insert(buckets)
      .values({ id, systemId, encryptedData: testBlob(), createdAt: now, updatedAt: now })
      .run();
    return id;
  }

  beforeAll(() => {
    client = new Database(":memory:");
    client.pragma("foreign_keys = ON");
    db = drizzle(client, { schema });
    createSqlitePrivacyTables(client);
  });

  afterAll(() => {
    client.close();
  });

  afterEach(() => {
    db.delete(bucketContentTags).run();
    db.delete(buckets).run();
  });

  describe("buckets", () => {
    it("inserts with encrypted_data and round-trips binary", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = brandId<BucketId>(crypto.randomUUID());
      const now = fixtureNow();
      const data = testBlob(new Uint8Array([10, 20, 30, 40, 50]));

      db.insert(buckets).values({ id, systemId, encryptedData: data, createdAt: now, updatedAt: now }).run();

      const rows = db.select().from(buckets).where(eq(buckets.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.systemId).toBe(systemId);
    });

    it("round-trips T2 blob with keyVersion and bucketId", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = brandId<BucketId>(crypto.randomUUID());
      const now = fixtureNow();
      const data = testBlobT2();

      db.insert(buckets).values({ id, systemId, encryptedData: data, createdAt: now, updatedAt: now }).run();

      const rows = db.select().from(buckets).where(eq(buckets.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
    });

    it("defaults version to 1", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = insertBucket(systemId);
      const rows = db.select().from(buckets).where(eq(buckets.id, id)).all();
      expect(rows[0]?.version).toBe(1);
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const bucketId = insertBucket(systemId);

      db.delete(systems).where(eq(systems.id, systemId)).run();
      const rows = db.select().from(buckets).where(eq(buckets.id, bucketId)).all();
      expect(rows).toHaveLength(0);
    });

    it("rejects nonexistent systemId FK", () => {
      const now = fixtureNow();
      expect(() =>
        db
          .insert(buckets)
          .values({
            id: brandId<BucketId>(crypto.randomUUID()),
            systemId: brandId<SystemId>("nonexistent"),
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
      const id = insertBucket(systemId);
      const rows = db.select().from(buckets).where(eq(buckets.id, id)).all();
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("round-trips archived: true with archivedAt", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = brandId<BucketId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(buckets)
        .values({ id, systemId, encryptedData: testBlob(new Uint8Array([1])), createdAt: now, updatedAt: now, archived: true, archivedAt: now })
        .run();

      const rows = db.select().from(buckets).where(eq(buckets.id, id)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("rejects archived=true with archivedAt=null via CHECK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = fixtureNow();

      expect(() =>
        client
          .prepare(
            "INSERT INTO buckets (id, system_id, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES (?, ?, X'010203', ?, ?, 1, 1, NULL)",
          )
          .run(crypto.randomUUID(), systemId, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("rejects archived=false with archivedAt set via CHECK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = fixtureNow();

      expect(() =>
        client
          .prepare(
            "INSERT INTO buckets (id, system_id, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES (?, ?, X'010203', ?, ?, 1, 0, ?)",
          )
          .run(crypto.randomUUID(), systemId, now, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("updates archived from false to true", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = insertBucket(systemId);
      const now = fixtureNow();

      db.update(buckets).set({ archived: true, archivedAt: now, updatedAt: now }).where(eq(buckets.id, id)).run();

      const rows = db.select().from(buckets).where(eq(buckets.id, id)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("updates archived from true back to false (unarchival)", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = insertBucket(systemId);
      const now = fixtureNow();

      db.update(buckets).set({ archived: true, archivedAt: now, updatedAt: now }).where(eq(buckets.id, id)).run();

      const unarchiveNow = fixtureNow();
      db.update(buckets).set({ archived: false, archivedAt: null, updatedAt: unarchiveNow }).where(eq(buckets.id, id)).run();

      const rows = db.select().from(buckets).where(eq(buckets.id, id)).all();
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });
  });

  // ── bucket_content_tags ────────────────────────────────────────────

  describe("bucket_content_tags", () => {
    it("inserts and queries by composite PK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const bucketId = insertBucket(systemId);
      const entityId = crypto.randomUUID();

      db.insert(bucketContentTags).values({ entityType: "member", entityId, bucketId, systemId }).run();

      const rows = db.select().from(bucketContentTags).where(eq(bucketContentTags.bucketId, bucketId)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.entityType).toBe("member");
      expect(rows[0]?.entityId).toBe(entityId);
    });

    it("cascades on bucket deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const bucketId = insertBucket(systemId);

      db.insert(bucketContentTags).values({ entityType: "fronting-session", entityId: crypto.randomUUID(), bucketId, systemId }).run();

      db.delete(buckets).where(eq(buckets.id, bucketId)).run();
      const rows = db.select().from(bucketContentTags).where(eq(bucketContentTags.bucketId, bucketId)).all();
      expect(rows).toHaveLength(0);
    });

    it("rejects invalid entityType CHECK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const bucketId = insertBucket(systemId);

      expect(() =>
        db.insert(bucketContentTags).values({ entityType: "invalid-type" as "member", entityId: crypto.randomUUID(), bucketId, systemId }).run(),
      ).toThrow();
    });

    it("composite PK prevents duplicates", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const bucketId = insertBucket(systemId);
      const entityId = crypto.randomUUID();

      db.insert(bucketContentTags).values({ entityType: "note", entityId, bucketId, systemId }).run();

      expect(() =>
        db.insert(bucketContentTags).values({ entityType: "note", entityId, bucketId, systemId }).run(),
      ).toThrow();
    });

    it("rejects nonexistent bucketId FK", () => {
      expect(() =>
        db
          .insert(bucketContentTags)
          .values({
            entityType: "member",
            entityId: crypto.randomUUID(),
            bucketId: brandId<BucketId>("nonexistent"),
            systemId: brandId<SystemId>("nonexistent"),
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("rejects infrastructure entity type via CHECK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const bucketId = insertBucket(systemId);

      expect(() =>
        db.insert(bucketContentTags).values({ entityType: "session" as "member", entityId: crypto.randomUUID(), bucketId, systemId }).run(),
      ).toThrow();
    });
  });
});
