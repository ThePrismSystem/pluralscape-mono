import { PGlite } from "@electric-sql/pglite";
import { brandId, toUnixMillis } from "@pluralscape/types";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/pg/auth.js";
import {
  bucketContentTags,
  buckets,
  friendBucketAssignments,
  friendCodes,
  friendConnections,
  keyGrants,
} from "../schema/pg/privacy.js";
import { systems } from "../schema/pg/systems.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import {
  createPgPrivacyTables,
  pgInsertAccount,
  pgInsertSystem,
  testBlob,
  testBlobT2,
} from "./helpers/pg-helpers.js";

import type {
  AccountId,
  BucketId,
  FriendCodeId,
  FriendConnectionId,
  KeyGrantId,
  SystemId,
} from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const schema = {
  accounts,
  systems,
  buckets,
  bucketContentTags,
  keyGrants,
  friendConnections,
  friendCodes,
  friendBucketAssignments,
};

describe("PG privacy schema", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;

  const insertAccount = (id?: string) => pgInsertAccount(db, id);
  const insertSystem = (accountId: AccountId, id?: string) => pgInsertSystem(db, accountId, id);

  async function insertBucket(
    systemId: SystemId,
    id: BucketId = brandId<BucketId>(crypto.randomUUID()),
  ): Promise<BucketId> {
    const now = fixtureNow();
    await db.insert(buckets).values({
      id,
      systemId,
      encryptedData: testBlob(),
      createdAt: now,
      updatedAt: now,
    });
    return id;
  }

  async function insertFriendConnection(
    accountId: AccountId,
    friendAccountId: AccountId,
    id: FriendConnectionId = brandId<FriendConnectionId>(crypto.randomUUID()),
  ): Promise<FriendConnectionId> {
    const now = fixtureNow();
    await db.insert(friendConnections).values({
      id,
      accountId,
      friendAccountId,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  }

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgPrivacyTables(client);
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(friendCodes);
    await db.delete(friendBucketAssignments);
    await db.delete(friendConnections);
    await db.delete(keyGrants);
    await db.delete(bucketContentTags);
    await db.delete(buckets);
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

  describe("friend_connections", () => {
    it("inserts with default status and version", async () => {
      const accountId = await insertAccount();
      await insertSystem(accountId);
      const friendAccountId = await insertAccount();
      await insertSystem(friendAccountId);
      const id = brandId<FriendConnectionId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(friendConnections).values({
        id,
        accountId,
        friendAccountId,
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(friendConnections).where(eq(friendConnections.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.status).toBe("pending");
      expect(rows[0]?.version).toBe(1);
      expect(rows[0]?.encryptedData).toBeNull();
    });

    it("rejects invalid status CHECK", async () => {
      const accountId = await insertAccount();
      await insertSystem(accountId);
      const friendAccountId = await insertAccount();
      await insertSystem(friendAccountId);
      const now = fixtureNow();

      await expect(
        db.execute(
          sql`INSERT INTO friend_connections (id, account_id, friend_account_id, status, created_at, updated_at, version) VALUES (${crypto.randomUUID()}, ${accountId}, ${friendAccountId}, 'invalid-status', ${now}, ${now}, 1)`,
        ),
      ).rejects.toThrow();
    });

    it("cascades on account deletion", async () => {
      const accountId = await insertAccount();
      await insertSystem(accountId);
      const friendAccountId = await insertAccount();
      await insertSystem(friendAccountId);
      const connectionId = await insertFriendConnection(accountId, friendAccountId);

      await db.delete(accounts).where(eq(accounts.id, accountId));
      const rows = await db
        .select()
        .from(friendConnections)
        .where(eq(friendConnections.id, connectionId));
      expect(rows).toHaveLength(0);
    });

    it("rejects self-friendship via CHECK", async () => {
      const accountId = await insertAccount();
      await insertSystem(accountId);
      const now = fixtureNow();

      await expect(
        db.insert(friendConnections).values({
          id: brandId<FriendConnectionId>(crypto.randomUUID()),
          accountId,
          friendAccountId: accountId,
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("rejects duplicate accountId + friendAccountId", async () => {
      const accountId = await insertAccount();
      await insertSystem(accountId);
      const friendAccountId = await insertAccount();
      await insertSystem(friendAccountId);
      const now = fixtureNow();

      await db.insert(friendConnections).values({
        id: brandId<FriendConnectionId>(crypto.randomUUID()),
        accountId,
        friendAccountId,
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        db.insert(friendConnections).values({
          id: brandId<FriendConnectionId>(crypto.randomUUID()),
          accountId,
          friendAccountId,
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("defaults archived to false and archivedAt to null", async () => {
      const accountId = await insertAccount();
      await insertSystem(accountId);
      const friendAccountId = await insertAccount();
      await insertSystem(friendAccountId);
      const id = brandId<FriendConnectionId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(friendConnections).values({
        id,
        accountId,
        friendAccountId,
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(friendConnections).where(eq(friendConnections.id, id));
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("round-trips archived: true with archivedAt", async () => {
      const accountId = await insertAccount();
      await insertSystem(accountId);
      const friendAccountId = await insertAccount();
      await insertSystem(friendAccountId);
      const id = brandId<FriendConnectionId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(friendConnections).values({
        id,
        accountId,
        friendAccountId,
        createdAt: now,
        updatedAt: now,
        archived: true,
        archivedAt: now,
      });

      const rows = await db.select().from(friendConnections).where(eq(friendConnections.id, id));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("updates archived from false to true", async () => {
      const accountId = await insertAccount();
      await insertSystem(accountId);
      const friendAccountId = await insertAccount();
      await insertSystem(friendAccountId);
      const id = await insertFriendConnection(accountId, friendAccountId);

      const now = fixtureNow();
      await db
        .update(friendConnections)
        .set({ archived: true, archivedAt: now })
        .where(eq(friendConnections.id, id));
      const rows = await db.select().from(friendConnections).where(eq(friendConnections.id, id));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("allows duplicate (accountId, friendAccountId) when both rows are archived", async () => {
      const accountId = await insertAccount();
      await insertSystem(accountId);
      const friendAccountId = await insertAccount();
      await insertSystem(friendAccountId);
      const now = fixtureNow();

      await db.insert(friendConnections).values({
        id: brandId<FriendConnectionId>(crypto.randomUUID()),
        accountId,
        friendAccountId,
        createdAt: now,
        updatedAt: now,
        archived: true,
        archivedAt: now,
      });

      await db.insert(friendConnections).values({
        id: brandId<FriendConnectionId>(crypto.randomUUID()),
        accountId,
        friendAccountId,
        createdAt: now,
        updatedAt: now,
        archived: true,
        archivedAt: now,
      });
    });

    it("rejects duplicate (accountId, friendAccountId) when both rows are active", async () => {
      const accountId = await insertAccount();
      await insertSystem(accountId);
      const friendAccountId = await insertAccount();
      await insertSystem(friendAccountId);
      const now = fixtureNow();

      await db.insert(friendConnections).values({
        id: brandId<FriendConnectionId>(crypto.randomUUID()),
        accountId,
        friendAccountId,
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        db.insert(friendConnections).values({
          id: brandId<FriendConnectionId>(crypto.randomUUID()),
          accountId,
          friendAccountId,
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("rejects archived=true with archivedAt=null via CHECK", async () => {
      const accountId = await insertAccount();
      await insertSystem(accountId);
      const friendAccountId = await insertAccount();
      await insertSystem(friendAccountId);
      const now = fixtureNow();

      await expect(
        client.query(
          "INSERT INTO friend_connections (id, account_id, friend_account_id, status, created_at, updated_at, version, archived, archived_at) VALUES ($1, $2, $3, 'pending', $4, $5, 1, true, NULL)",
          [crypto.randomUUID(), accountId, friendAccountId, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });

    it("rejects archived=false with archivedAt set via CHECK", async () => {
      const accountId = await insertAccount();
      await insertSystem(accountId);
      const friendAccountId = await insertAccount();
      await insertSystem(friendAccountId);
      const now = fixtureNow();

      await expect(
        client.query(
          "INSERT INTO friend_connections (id, account_id, friend_account_id, status, created_at, updated_at, version, archived, archived_at) VALUES ($1, $2, $3, 'pending', $4, $5, 1, false, $6)",
          [crypto.randomUUID(), accountId, friendAccountId, now, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });
  });

  describe("friend_codes", () => {
    it("inserts and queries by id", async () => {
      const accountId = await insertAccount();
      await insertSystem(accountId);
      const id = brandId<FriendCodeId>(crypto.randomUUID());
      const code = `CODE_${crypto.randomUUID()}`;
      const now = fixtureNow();

      await db.insert(friendCodes).values({
        id,
        accountId,
        code,
        createdAt: now,
      });

      const rows = await db.select().from(friendCodes).where(eq(friendCodes.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.code).toBe(code);
      expect(rows[0]?.accountId).toBe(accountId);
    });

    it("allows nullable expiresAt", async () => {
      const accountId = await insertAccount();
      await insertSystem(accountId);
      const id = brandId<FriendCodeId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(friendCodes).values({
        id,
        accountId,
        code: `CODE_${crypto.randomUUID()}`,
        createdAt: now,
      });

      const rows = await db.select().from(friendCodes).where(eq(friendCodes.id, id));
      expect(rows[0]?.expiresAt).toBeNull();
    });

    it("enforces unique code", async () => {
      const accountId = await insertAccount();
      await insertSystem(accountId);
      const code = `CODE_${crypto.randomUUID()}`;
      const now = fixtureNow();

      await db.insert(friendCodes).values({
        id: brandId<FriendCodeId>(crypto.randomUUID()),
        accountId,
        code,
        createdAt: now,
      });

      await expect(
        db.insert(friendCodes).values({
          id: brandId<FriendCodeId>(crypto.randomUUID()),
          accountId,
          code,
          createdAt: now,
        }),
      ).rejects.toThrow();
    });

    it("cascades on account deletion", async () => {
      const accountId = await insertAccount();
      await insertSystem(accountId);
      const codeId = brandId<FriendCodeId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(friendCodes).values({
        id: codeId,
        accountId,
        code: `CODE_${crypto.randomUUID()}`,
        createdAt: now,
      });

      await db.delete(accounts).where(eq(accounts.id, accountId));
      const rows = await db.select().from(friendCodes).where(eq(friendCodes.id, codeId));
      expect(rows).toHaveLength(0);
    });

    it("rejects code shorter than 8 characters via CHECK", async () => {
      const accountId = await insertAccount();
      await insertSystem(accountId);
      const now = fixtureNow();

      await expect(
        db.insert(friendCodes).values({
          id: brandId<FriendCodeId>(crypto.randomUUID()),
          accountId,
          code: "SHORT",
          createdAt: now,
        }),
      ).rejects.toThrow();
    });

    it("accepts code exactly 8 characters", async () => {
      const accountId = await insertAccount();
      await insertSystem(accountId);
      const now = fixtureNow();

      await db.insert(friendCodes).values({
        id: brandId<FriendCodeId>(crypto.randomUUID()),
        accountId,
        code: "ABCD1234",
        createdAt: now,
      });
    });

    it("rejects expiresAt <= createdAt via CHECK", async () => {
      const accountId = await insertAccount();
      await insertSystem(accountId);
      const now = fixtureNow();

      await expect(
        db.insert(friendCodes).values({
          id: brandId<FriendCodeId>(crypto.randomUUID()),
          accountId,
          code: `CODE_${crypto.randomUUID()}`,
          createdAt: now,
          expiresAt: toUnixMillis(now - 1000),
        }),
      ).rejects.toThrow();
    });

    it("rejects expiresAt === createdAt via CHECK", async () => {
      const accountId = await insertAccount();
      await insertSystem(accountId);
      const now = fixtureNow();

      await expect(
        db.insert(friendCodes).values({
          id: brandId<FriendCodeId>(crypto.randomUUID()),
          accountId,
          code: `CODE_${crypto.randomUUID()}`,
          createdAt: now,
          expiresAt: now,
        }),
      ).rejects.toThrow();
    });

    it("defaults archived to false and archivedAt to null", async () => {
      const accountId = await insertAccount();
      await insertSystem(accountId);
      const id = brandId<FriendCodeId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(friendCodes).values({
        id,
        accountId,
        code: `CODE_${crypto.randomUUID()}`,
        createdAt: now,
      });

      const rows = await db.select().from(friendCodes).where(eq(friendCodes.id, id));
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("round-trips archived: true with archivedAt", async () => {
      const accountId = await insertAccount();
      await insertSystem(accountId);
      const id = brandId<FriendCodeId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(friendCodes).values({
        id,
        accountId,
        code: `CODE_${crypto.randomUUID()}`,
        createdAt: now,
        archived: true,
        archivedAt: now,
      });

      const rows = await db.select().from(friendCodes).where(eq(friendCodes.id, id));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("updates archived from false to true", async () => {
      const accountId = await insertAccount();
      await insertSystem(accountId);
      const id = brandId<FriendCodeId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(friendCodes).values({
        id,
        accountId,
        code: `CODE_${crypto.randomUUID()}`,
        createdAt: now,
      });

      const updateNow = fixtureNow();
      await db
        .update(friendCodes)
        .set({ archived: true, archivedAt: updateNow })
        .where(eq(friendCodes.id, id));
      const rows = await db.select().from(friendCodes).where(eq(friendCodes.id, id));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(updateNow);
    });

    it("rejects archived=true with archivedAt=null via CHECK", async () => {
      const accountId = await insertAccount();
      await insertSystem(accountId);
      const now = fixtureNow();

      await expect(
        client.query(
          "INSERT INTO friend_codes (id, account_id, code, created_at, archived, archived_at) VALUES ($1, $2, $3, $4, true, NULL)",
          [crypto.randomUUID(), accountId, `CODE_${crypto.randomUUID()}`, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });

    it("rejects archived=false with archivedAt set via CHECK", async () => {
      const accountId = await insertAccount();
      await insertSystem(accountId);
      const now = fixtureNow();

      await expect(
        client.query(
          "INSERT INTO friend_codes (id, account_id, code, created_at, archived, archived_at) VALUES ($1, $2, $3, $4, false, $5)",
          [crypto.randomUUID(), accountId, `CODE_${crypto.randomUUID()}`, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });

    it("allows duplicate code when both rows are archived", async () => {
      const accountId = await insertAccount();
      await insertSystem(accountId);
      const code = `CODE_${crypto.randomUUID()}`;
      const now = fixtureNow();

      await db.insert(friendCodes).values({
        id: brandId<FriendCodeId>(crypto.randomUUID()),
        accountId,
        code,
        createdAt: now,
        archived: true,
        archivedAt: now,
      });

      await db.insert(friendCodes).values({
        id: brandId<FriendCodeId>(crypto.randomUUID()),
        accountId,
        code,
        createdAt: now,
        archived: true,
        archivedAt: now,
      });

      const rows = await db.select().from(friendCodes).where(eq(friendCodes.code, code));
      expect(rows).toHaveLength(2);
    });

    it("allows reuse of archived code for a new active entry", async () => {
      const accountId = await insertAccount();
      await insertSystem(accountId);
      const code = `CODE_${crypto.randomUUID()}`;
      const now = fixtureNow();

      await db.insert(friendCodes).values({
        id: brandId<FriendCodeId>(crypto.randomUUID()),
        accountId,
        code,
        createdAt: now,
        archived: true,
        archivedAt: now,
      });

      await db.insert(friendCodes).values({
        id: brandId<FriendCodeId>(crypto.randomUUID()),
        accountId,
        code,
        createdAt: now,
      });

      const rows = await db.select().from(friendCodes).where(eq(friendCodes.code, code));
      expect(rows).toHaveLength(2);
      expect(rows.filter((r) => !r.archived)).toHaveLength(1);
    });
  });

  describe("friend_bucket_assignments", () => {
    it("inserts and queries by connection", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const friendAccountId = await insertAccount();
      await insertSystem(friendAccountId);
      const bucketId = await insertBucket(systemId);
      const connectionId = await insertFriendConnection(accountId, friendAccountId);

      await db.insert(friendBucketAssignments).values({
        friendConnectionId: connectionId,
        bucketId,
        systemId,
      });

      const rows = await db
        .select()
        .from(friendBucketAssignments)
        .where(eq(friendBucketAssignments.friendConnectionId, connectionId));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.bucketId).toBe(bucketId);
    });

    it("restricts connection deletion when referenced by assignment", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const friendAccountId = await insertAccount();
      await insertSystem(friendAccountId);
      const bucketId = await insertBucket(systemId);
      const connectionId = await insertFriendConnection(accountId, friendAccountId);

      await db.insert(friendBucketAssignments).values({
        friendConnectionId: connectionId,
        bucketId,
        systemId,
      });

      await expect(
        db.delete(friendConnections).where(eq(friendConnections.id, connectionId)),
      ).rejects.toThrow();
    });

    it("restricts bucket deletion when referenced by assignment", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const friendAccountId = await insertAccount();
      await insertSystem(friendAccountId);
      const bucketId = await insertBucket(systemId);
      const connectionId = await insertFriendConnection(accountId, friendAccountId);

      await db.insert(friendBucketAssignments).values({
        friendConnectionId: connectionId,
        bucketId,
        systemId,
      });

      await expect(db.delete(buckets).where(eq(buckets.id, bucketId))).rejects.toThrow();
    });

    it("composite PK prevents duplicates", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const friendAccountId = await insertAccount();
      await insertSystem(friendAccountId);
      const bucketId = await insertBucket(systemId);
      const connectionId = await insertFriendConnection(accountId, friendAccountId);

      await db.insert(friendBucketAssignments).values({
        friendConnectionId: connectionId,
        bucketId,
        systemId,
      });

      await expect(
        db.insert(friendBucketAssignments).values({
          friendConnectionId: connectionId,
          bucketId,
          systemId,
        }),
      ).rejects.toThrow();
    });

    it("rejects nonexistent friendConnectionId FK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const bucketId = await insertBucket(systemId);

      await expect(
        db.insert(friendBucketAssignments).values({
          friendConnectionId: brandId<FriendConnectionId>("nonexistent"),
          bucketId,
          systemId,
        }),
      ).rejects.toThrow();
    });

    it("rejects nonexistent bucketId FK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const friendAccountId = await insertAccount();
      await insertSystem(friendAccountId);
      const connectionId = await insertFriendConnection(accountId, friendAccountId);

      await expect(
        db.insert(friendBucketAssignments).values({
          friendConnectionId: connectionId,
          bucketId: brandId<BucketId>("nonexistent"),
          systemId,
        }),
      ).rejects.toThrow();
    });
  });
});
