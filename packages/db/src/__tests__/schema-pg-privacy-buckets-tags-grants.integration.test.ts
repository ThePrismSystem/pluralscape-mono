import { brandId } from "@pluralscape/types";
import { eq, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { bucketContentTags, buckets, keyGrants } from "../schema/pg/privacy.js";
import { systems } from "../schema/pg/systems.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import { testBlob, testBlobT2 } from "./helpers/pg-helpers.js";
import {
  clearPrivacyTables,
  insertAccount as insertAccountWith,
  insertBucket as insertBucketWith,
  insertSystem as insertSystemWith,
  setupPrivacyFixture,
  teardownPrivacyFixture,
  type PrivacyDb,
} from "./helpers/privacy-fixtures.js";

import type { PGlite } from "@electric-sql/pglite";
import type { AccountId, BucketId, KeyGrantId, SystemId } from "@pluralscape/types";

describe("PG privacy schema — buckets, tags, key grants", () => {
  let client: PGlite;
  let db: PrivacyDb;

  const insertAccount = (id?: string) => insertAccountWith(db, id);
  const insertSystem = (accountId: AccountId, id?: string) => insertSystemWith(db, accountId, id);
  const insertBucket = (systemId: SystemId, id?: BucketId) => insertBucketWith(db, systemId, id);

  beforeAll(async () => {
    const fixture = await setupPrivacyFixture();
    client = fixture.client;
    db = fixture.db;
  });

  afterAll(async () => {
    await teardownPrivacyFixture({ client, db });
  });

  afterEach(async () => {
    await clearPrivacyTables(db);
  });

  describe("buckets", () => {
    it("inserts with encrypted_data and round-trips binary", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<BucketId>(crypto.randomUUID());
      const now = fixtureNow();
      const data = testBlob(new Uint8Array([10, 20, 30, 40, 50]));

      await db.insert(buckets).values({
        id,
        systemId,
        encryptedData: data,
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(buckets).where(eq(buckets.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.systemId).toBe(systemId);
    });

    it("round-trips T2 blob with keyVersion and bucketId", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<BucketId>(crypto.randomUUID());
      const now = fixtureNow();
      const data = testBlobT2();

      await db.insert(buckets).values({
        id,
        systemId,
        encryptedData: data,
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(buckets).where(eq(buckets.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
    });

    it("defaults version to 1", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<BucketId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(buckets).values({
        id,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(buckets).where(eq(buckets.id, id));
      expect(rows[0]?.version).toBe(1);
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const bucketId = await insertBucket(systemId);

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db.select().from(buckets).where(eq(buckets.id, bucketId));
      expect(rows).toHaveLength(0);
    });

    it("rejects nonexistent systemId FK", async () => {
      const now = fixtureNow();
      await expect(
        db.insert(buckets).values({
          id: brandId<BucketId>(crypto.randomUUID()),
          systemId: brandId<SystemId>("nonexistent"),
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("defaults archived to false and archivedAt to null", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<BucketId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(buckets).values({
        id,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(buckets).where(eq(buckets.id, id));
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("round-trips archived: true with archivedAt", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<BucketId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(buckets).values({
        id,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
        archived: true,
        archivedAt: now,
      });

      const rows = await db.select().from(buckets).where(eq(buckets.id, id));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("updates archived from false to true", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = await insertBucket(systemId);

      const now = fixtureNow();
      await db.update(buckets).set({ archived: true, archivedAt: now }).where(eq(buckets.id, id));
      const rows = await db.select().from(buckets).where(eq(buckets.id, id));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("updates archived from true back to false (unarchival)", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = await insertBucket(systemId);

      const archiveNow = fixtureNow();
      await db
        .update(buckets)
        .set({ archived: true, archivedAt: archiveNow })
        .where(eq(buckets.id, id));

      await db.update(buckets).set({ archived: false, archivedAt: null }).where(eq(buckets.id, id));

      const rows = await db.select().from(buckets).where(eq(buckets.id, id));
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("rejects archived=true with archivedAt=null via CHECK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = fixtureNow();

      await expect(
        client.query(
          "INSERT INTO buckets (id, system_id, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES ($1, $2, '\\x010203'::bytea, $3, $4, 1, true, NULL)",
          [crypto.randomUUID(), systemId, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });

    it("rejects archived=false with archivedAt set via CHECK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = fixtureNow();

      await expect(
        client.query(
          "INSERT INTO buckets (id, system_id, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES ($1, $2, '\\x010203'::bytea, $3, $4, 1, false, $5)",
          [crypto.randomUUID(), systemId, now, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });
  });

  describe("bucket_content_tags", () => {
    it("inserts and queries by composite PK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const bucketId = await insertBucket(systemId);
      const entityId = crypto.randomUUID();

      await db.insert(bucketContentTags).values({
        entityType: "member",
        entityId,
        bucketId,
        systemId,
      });

      const rows = await db
        .select()
        .from(bucketContentTags)
        .where(eq(bucketContentTags.bucketId, bucketId));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.entityType).toBe("member");
      expect(rows[0]?.entityId).toBe(entityId);
    });

    it("restricts bucket deletion when referenced by content tag", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const bucketId = await insertBucket(systemId);

      await db.insert(bucketContentTags).values({
        entityType: "note",
        entityId: crypto.randomUUID(),
        bucketId,
        systemId,
      });

      await expect(db.delete(buckets).where(eq(buckets.id, bucketId))).rejects.toThrow();
    });

    it("rejects invalid entityType CHECK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const bucketId = await insertBucket(systemId);

      await expect(
        db.execute(
          sql`INSERT INTO bucket_content_tags (entity_type, entity_id, bucket_id) VALUES ('invalid-type', ${crypto.randomUUID()}, ${bucketId})`,
        ),
      ).rejects.toThrow();
    });

    it("composite PK prevents duplicates", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const bucketId = await insertBucket(systemId);
      const entityId = crypto.randomUUID();

      await db.insert(bucketContentTags).values({
        entityType: "channel",
        entityId,
        bucketId,
        systemId,
      });

      await expect(
        db.insert(bucketContentTags).values({
          entityType: "channel",
          entityId,
          bucketId,
          systemId,
        }),
      ).rejects.toThrow();
    });

    it("rejects nonexistent bucketId FK", async () => {
      await expect(
        db.insert(bucketContentTags).values({
          entityType: "member",
          entityId: crypto.randomUUID(),
          bucketId: brandId<BucketId>("nonexistent"),
          systemId: brandId<SystemId>("nonexistent"),
        }),
      ).rejects.toThrow();
    });

    it("rejects infrastructure entity type via CHECK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const bucketId = await insertBucket(systemId);

      await expect(
        db.execute(
          sql`INSERT INTO bucket_content_tags (entity_type, entity_id, bucket_id) VALUES ('session', ${crypto.randomUUID()}, ${bucketId})`,
        ),
      ).rejects.toThrow();
    });
  });

  describe("key_grants", () => {
    it("inserts and round-trips encrypted key", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const bucketId = await insertBucket(systemId);
      const friendAccountId = await insertAccount();
      await insertSystem(friendAccountId);
      const id = brandId<KeyGrantId>(crypto.randomUUID());
      const now = fixtureNow();
      const keyData = new Uint8Array([99, 88, 77]);

      await db.insert(keyGrants).values({
        id,
        bucketId,
        systemId,
        friendAccountId,
        encryptedKey: keyData,
        keyVersion: 1,
        createdAt: now,
      });

      const rows = await db.select().from(keyGrants).where(eq(keyGrants.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedKey).toEqual(keyData);
      expect(rows[0]?.bucketId).toBe(bucketId);
      expect(rows[0]?.friendAccountId).toBe(friendAccountId);
      expect(rows[0]?.keyVersion).toBe(1);
    });

    it("allows nullable revokedAt", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const bucketId = await insertBucket(systemId);
      const friendAccountId = await insertAccount();
      await insertSystem(friendAccountId);
      const id = brandId<KeyGrantId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(keyGrants).values({
        id,
        bucketId,
        systemId,
        friendAccountId,
        encryptedKey: new Uint8Array([1]),
        keyVersion: 1,
        createdAt: now,
      });

      const rows = await db.select().from(keyGrants).where(eq(keyGrants.id, id));
      expect(rows[0]?.revokedAt).toBeNull();
    });

    it("restricts bucket deletion when referenced by key grant", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const bucketId = await insertBucket(systemId);
      const friendAccountId = await insertAccount();
      await insertSystem(friendAccountId);
      const now = fixtureNow();

      await db.insert(keyGrants).values({
        id: brandId<KeyGrantId>(crypto.randomUUID()),
        bucketId,
        systemId,
        friendAccountId,
        encryptedKey: new Uint8Array([1]),
        keyVersion: 1,
        createdAt: now,
      });

      await expect(db.delete(buckets).where(eq(buckets.id, bucketId))).rejects.toThrow();
    });

    it("rejects keyVersion = 0 via CHECK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const bucketId = await insertBucket(systemId);
      const friendAccountId = await insertAccount();
      await insertSystem(friendAccountId);
      const now = fixtureNow();

      await expect(
        db.insert(keyGrants).values({
          id: brandId<KeyGrantId>(crypto.randomUUID()),
          bucketId,
          systemId,
          friendAccountId,
          encryptedKey: new Uint8Array([1]),
          keyVersion: 0,
          createdAt: now,
        }),
      ).rejects.toThrow();
    });

    it("rejects duplicate bucket + friendAccount + keyVersion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const bucketId = await insertBucket(systemId);
      const friendAccountId = await insertAccount();
      await insertSystem(friendAccountId);
      const now = fixtureNow();

      await db.insert(keyGrants).values({
        id: brandId<KeyGrantId>(crypto.randomUUID()),
        bucketId,
        systemId,
        friendAccountId,
        encryptedKey: new Uint8Array([1]),
        keyVersion: 1,
        createdAt: now,
      });

      await expect(
        db.insert(keyGrants).values({
          id: brandId<KeyGrantId>(crypto.randomUUID()),
          bucketId,
          systemId,
          friendAccountId,
          encryptedKey: new Uint8Array([2]),
          keyVersion: 1,
          createdAt: now,
        }),
      ).rejects.toThrow();
    });

    it("rejects nonexistent friendAccountId FK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const bucketId = await insertBucket(systemId);
      const now = fixtureNow();

      await expect(
        db.insert(keyGrants).values({
          id: brandId<KeyGrantId>(crypto.randomUUID()),
          bucketId,
          systemId,
          friendAccountId: brandId<AccountId>("nonexistent"),
          encryptedKey: new Uint8Array([1]),
          keyVersion: 1,
          createdAt: now,
        }),
      ).rejects.toThrow();
    });
  });
});
