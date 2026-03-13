import { PGlite } from "@electric-sql/pglite";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

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

import {
  createPgPrivacyTables,
  pgInsertAccount,
  pgInsertSystem,
  testBlob,
  testBlobT2,
} from "./helpers/pg-helpers.js";

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
  const insertSystem = (accountId: string, id?: string) => pgInsertSystem(db, accountId, id);

  async function insertBucket(systemId: string, id = crypto.randomUUID()): Promise<string> {
    const now = Date.now();
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
    accountId: string,
    friendAccountId: string,
    id = crypto.randomUUID(),
  ): Promise<string> {
    const now = Date.now();
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

  describe("buckets", () => {
    it("inserts with encrypted_data and round-trips binary", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();
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
      const id = crypto.randomUUID();
      const now = Date.now();
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
      const id = crypto.randomUUID();
      const now = Date.now();

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
      const now = Date.now();
      await expect(
        db.insert(buckets).values({
          id: crypto.randomUUID(),
          systemId: "nonexistent",
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
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

    it("cascades on bucket deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const bucketId = await insertBucket(systemId);

      await db.insert(bucketContentTags).values({
        entityType: "note",
        entityId: crypto.randomUUID(),
        bucketId,
        systemId,
      });

      await db.delete(buckets).where(eq(buckets.id, bucketId));
      const rows = await db
        .select()
        .from(bucketContentTags)
        .where(eq(bucketContentTags.bucketId, bucketId));
      expect(rows).toHaveLength(0);
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
          bucketId: "nonexistent",
          systemId: "nonexistent",
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
      const id = crypto.randomUUID();
      const now = Date.now();
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
      const id = crypto.randomUUID();
      const now = Date.now();

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

    it("cascades on bucket deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const bucketId = await insertBucket(systemId);
      const friendAccountId = await insertAccount();
      await insertSystem(friendAccountId);
      const grantId = crypto.randomUUID();
      const now = Date.now();

      await db.insert(keyGrants).values({
        id: grantId,
        bucketId,
        systemId,
        friendAccountId,
        encryptedKey: new Uint8Array([1]),
        keyVersion: 1,
        createdAt: now,
      });

      await db.delete(buckets).where(eq(buckets.id, bucketId));
      const rows = await db.select().from(keyGrants).where(eq(keyGrants.id, grantId));
      expect(rows).toHaveLength(0);
    });

    it("rejects keyVersion = 0 via CHECK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const bucketId = await insertBucket(systemId);
      const friendAccountId = await insertAccount();
      await insertSystem(friendAccountId);
      const now = Date.now();

      await expect(
        db.insert(keyGrants).values({
          id: crypto.randomUUID(),
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
      const now = Date.now();

      await db.insert(keyGrants).values({
        id: crypto.randomUUID(),
        bucketId,
        systemId,
        friendAccountId,
        encryptedKey: new Uint8Array([1]),
        keyVersion: 1,
        createdAt: now,
      });

      await expect(
        db.insert(keyGrants).values({
          id: crypto.randomUUID(),
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
      const now = Date.now();

      await expect(
        db.insert(keyGrants).values({
          id: crypto.randomUUID(),
          bucketId,
          systemId,
          friendAccountId: "nonexistent",
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
      const id = crypto.randomUUID();
      const now = Date.now();

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
      const now = Date.now();

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
      const now = Date.now();

      await expect(
        db.insert(friendConnections).values({
          id: crypto.randomUUID(),
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
      const now = Date.now();

      await db.insert(friendConnections).values({
        id: crypto.randomUUID(),
        accountId,
        friendAccountId,
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        db.insert(friendConnections).values({
          id: crypto.randomUUID(),
          accountId,
          friendAccountId,
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });
  });

  describe("friend_codes", () => {
    it("inserts and queries by id", async () => {
      const accountId = await insertAccount();
      await insertSystem(accountId);
      const id = crypto.randomUUID();
      const code = `CODE_${crypto.randomUUID()}`;
      const now = Date.now();

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
      const id = crypto.randomUUID();
      const now = Date.now();

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
      const now = Date.now();

      await db.insert(friendCodes).values({
        id: crypto.randomUUID(),
        accountId,
        code,
        createdAt: now,
      });

      await expect(
        db.insert(friendCodes).values({
          id: crypto.randomUUID(),
          accountId,
          code,
          createdAt: now,
        }),
      ).rejects.toThrow();
    });

    it("cascades on account deletion", async () => {
      const accountId = await insertAccount();
      await insertSystem(accountId);
      const codeId = crypto.randomUUID();
      const now = Date.now();

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
      const now = Date.now();

      await expect(
        db.insert(friendCodes).values({
          id: crypto.randomUUID(),
          accountId,
          code: "SHORT",
          createdAt: now,
        }),
      ).rejects.toThrow();
    });

    it("accepts code exactly 8 characters", async () => {
      const accountId = await insertAccount();
      await insertSystem(accountId);
      const now = Date.now();

      await db.insert(friendCodes).values({
        id: crypto.randomUUID(),
        accountId,
        code: "ABCD1234",
        createdAt: now,
      });
    });

    it("rejects expiresAt <= createdAt via CHECK", async () => {
      const accountId = await insertAccount();
      await insertSystem(accountId);
      const now = Date.now();

      await expect(
        db.insert(friendCodes).values({
          id: crypto.randomUUID(),
          accountId,
          code: `CODE_${crypto.randomUUID()}`,
          createdAt: now,
          expiresAt: now - 1000,
        }),
      ).rejects.toThrow();
    });

    it("rejects expiresAt === createdAt via CHECK", async () => {
      const accountId = await insertAccount();
      await insertSystem(accountId);
      const now = Date.now();

      await expect(
        db.insert(friendCodes).values({
          id: crypto.randomUUID(),
          accountId,
          code: `CODE_${crypto.randomUUID()}`,
          createdAt: now,
          expiresAt: now,
        }),
      ).rejects.toThrow();
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

    it("cascades on connection deletion", async () => {
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

      await db.delete(friendConnections).where(eq(friendConnections.id, connectionId));
      const rows = await db
        .select()
        .from(friendBucketAssignments)
        .where(eq(friendBucketAssignments.friendConnectionId, connectionId));
      expect(rows).toHaveLength(0);
    });

    it("cascades on bucket deletion", async () => {
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

      await db.delete(buckets).where(eq(buckets.id, bucketId));
      const rows = await db
        .select()
        .from(friendBucketAssignments)
        .where(eq(friendBucketAssignments.bucketId, bucketId));
      expect(rows).toHaveLength(0);
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
          friendConnectionId: "nonexistent",
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
          bucketId: "nonexistent",
          systemId,
        }),
      ).rejects.toThrow();
    });
  });
});
