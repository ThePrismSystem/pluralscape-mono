import Database from "better-sqlite3-multiple-ciphers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/sqlite/auth.js";
import {
  bucketContentTags,
  buckets,
  friendBucketAssignments,
  friendCodes,
  friendConnections,
  keyGrants,
} from "../schema/sqlite/privacy.js";
import { systems } from "../schema/sqlite/systems.js";

import {
  createSqlitePrivacyTables,
  sqliteInsertAccount,
  sqliteInsertSystem,
  testBlob,
  testBlobT2,
} from "./helpers/sqlite-helpers.js";

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

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

describe("SQLite privacy schema", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  const insertAccount = (id?: string): string => sqliteInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string): string =>
    sqliteInsertSystem(db, accountId, id);

  function insertBucket(systemId: string, id = crypto.randomUUID()): string {
    const now = Date.now();
    db.insert(buckets)
      .values({
        id,
        systemId,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      })
      .run();
    return id;
  }

  function insertFriendConnection(
    systemId: string,
    friendSystemId: string,
    id = crypto.randomUUID(),
  ): string {
    const now = Date.now();
    db.insert(friendConnections)
      .values({
        id,
        systemId,
        friendSystemId,
        createdAt: now,
        updatedAt: now,
      })
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

  describe("buckets", () => {
    it("inserts with encrypted_data and round-trips binary", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = testBlob(new Uint8Array([10, 20, 30, 40, 50]));

      db.insert(buckets)
        .values({
          id,
          systemId,
          encryptedData: data,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(buckets).where(eq(buckets.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.systemId).toBe(systemId);
    });

    it("round-trips T2 blob with keyVersion and bucketId", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = testBlobT2();

      db.insert(buckets)
        .values({
          id,
          systemId,
          encryptedData: data,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(buckets).where(eq(buckets.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
    });

    it("defaults version to 1", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(buckets)
        .values({
          id,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

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
      const now = Date.now();
      expect(() =>
        db
          .insert(buckets)
          .values({
            id: crypto.randomUUID(),
            systemId: "nonexistent",
            encryptedData: testBlob(new Uint8Array([1])),
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });
  });

  describe("bucket_content_tags", () => {
    it("inserts and queries by composite PK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const bucketId = insertBucket(systemId);
      const entityId = crypto.randomUUID();

      db.insert(bucketContentTags)
        .values({
          entityType: "member",
          entityId,
          bucketId,
        })
        .run();

      const rows = db
        .select()
        .from(bucketContentTags)
        .where(eq(bucketContentTags.bucketId, bucketId))
        .all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.entityType).toBe("member");
      expect(rows[0]?.entityId).toBe(entityId);
    });

    it("cascades on bucket deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const bucketId = insertBucket(systemId);
      const entityId = crypto.randomUUID();

      db.insert(bucketContentTags)
        .values({
          entityType: "fronting-session",
          entityId,
          bucketId,
        })
        .run();

      db.delete(buckets).where(eq(buckets.id, bucketId)).run();
      const rows = db
        .select()
        .from(bucketContentTags)
        .where(eq(bucketContentTags.bucketId, bucketId))
        .all();
      expect(rows).toHaveLength(0);
    });

    it("rejects invalid entityType CHECK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const bucketId = insertBucket(systemId);

      expect(() =>
        db
          .insert(bucketContentTags)
          .values({
            entityType: "invalid-type" as "member",
            entityId: crypto.randomUUID(),
            bucketId,
          })
          .run(),
      ).toThrow();
    });

    it("composite PK prevents duplicates", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const bucketId = insertBucket(systemId);
      const entityId = crypto.randomUUID();

      db.insert(bucketContentTags)
        .values({
          entityType: "note",
          entityId,
          bucketId,
        })
        .run();

      expect(() =>
        db
          .insert(bucketContentTags)
          .values({
            entityType: "note",
            entityId,
            bucketId,
          })
          .run(),
      ).toThrow();
    });

    it("rejects nonexistent bucketId FK", () => {
      expect(() =>
        db
          .insert(bucketContentTags)
          .values({
            entityType: "member",
            entityId: crypto.randomUUID(),
            bucketId: "nonexistent",
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("rejects infrastructure entity type via CHECK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const bucketId = insertBucket(systemId);

      expect(() =>
        db
          .insert(bucketContentTags)
          .values({
            entityType: "session" as "member",
            entityId: crypto.randomUUID(),
            bucketId,
          })
          .run(),
      ).toThrow();
    });
  });

  describe("key_grants", () => {
    it("inserts with encrypted_key and round-trips binary", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const bucketId = insertBucket(systemId);
      const friendAccountId = insertAccount();
      const friendSystemId = insertSystem(friendAccountId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const keyData = new Uint8Array([99, 88, 77, 66]);

      db.insert(keyGrants)
        .values({
          id,
          bucketId,
          friendSystemId,
          encryptedKey: keyData,
          keyVersion: 1,
          createdAt: now,
        })
        .run();

      const rows = db.select().from(keyGrants).where(eq(keyGrants.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedKey).toEqual(keyData);
      expect(rows[0]?.bucketId).toBe(bucketId);
      expect(rows[0]?.friendSystemId).toBe(friendSystemId);
      expect(rows[0]?.keyVersion).toBe(1);
    });

    it("allows nullable revokedAt", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const bucketId = insertBucket(systemId);
      const friendAccountId = insertAccount();
      const friendSystemId = insertSystem(friendAccountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(keyGrants)
        .values({
          id,
          bucketId,
          friendSystemId,
          encryptedKey: new Uint8Array([1]),
          keyVersion: 1,
          createdAt: now,
        })
        .run();

      const rows = db.select().from(keyGrants).where(eq(keyGrants.id, id)).all();
      expect(rows[0]?.revokedAt).toBeNull();
    });

    it("cascades on bucket deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const bucketId = insertBucket(systemId);
      const friendAccountId = insertAccount();
      const friendSystemId = insertSystem(friendAccountId);
      const grantId = crypto.randomUUID();
      const now = Date.now();

      db.insert(keyGrants)
        .values({
          id: grantId,
          bucketId,
          friendSystemId,
          encryptedKey: new Uint8Array([1]),
          keyVersion: 1,
          createdAt: now,
        })
        .run();

      db.delete(buckets).where(eq(buckets.id, bucketId)).run();
      const rows = db.select().from(keyGrants).where(eq(keyGrants.id, grantId)).all();
      expect(rows).toHaveLength(0);
    });

    it("rejects keyVersion = 0 via CHECK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const bucketId = insertBucket(systemId);
      const friendAccountId = insertAccount();
      const friendSystemId = insertSystem(friendAccountId);
      const now = Date.now();

      expect(() =>
        db
          .insert(keyGrants)
          .values({
            id: crypto.randomUUID(),
            bucketId,
            friendSystemId,
            encryptedKey: new Uint8Array([1]),
            keyVersion: 0,
            createdAt: now,
          })
          .run(),
      ).toThrow();
    });

    it("rejects duplicate (bucketId, friendSystemId, keyVersion)", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const bucketId = insertBucket(systemId);
      const friendAccountId = insertAccount();
      const friendSystemId = insertSystem(friendAccountId);
      const now = Date.now();

      db.insert(keyGrants)
        .values({
          id: crypto.randomUUID(),
          bucketId,
          friendSystemId,
          encryptedKey: new Uint8Array([1]),
          keyVersion: 1,
          createdAt: now,
        })
        .run();

      expect(() =>
        db
          .insert(keyGrants)
          .values({
            id: crypto.randomUUID(),
            bucketId,
            friendSystemId,
            encryptedKey: new Uint8Array([2]),
            keyVersion: 1,
            createdAt: now,
          })
          .run(),
      ).toThrow();
    });

    it("rejects nonexistent friendSystemId FK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const bucketId = insertBucket(systemId);
      const now = Date.now();

      expect(() =>
        db
          .insert(keyGrants)
          .values({
            id: crypto.randomUUID(),
            bucketId,
            friendSystemId: "nonexistent",
            encryptedKey: new Uint8Array([1]),
            keyVersion: 1,
            createdAt: now,
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });
  });

  describe("friend_connections", () => {
    it("inserts with defaults and round-trips", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const friendAccountId = insertAccount();
      const friendSystemId = insertSystem(friendAccountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(friendConnections)
        .values({
          id,
          systemId,
          friendSystemId,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(friendConnections).where(eq(friendConnections.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.status).toBe("pending");
      expect(rows[0]?.version).toBe(1);
      expect(rows[0]?.encryptedData).toBeNull();
    });

    it("rejects invalid status CHECK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const friendAccountId = insertAccount();
      const friendSystemId = insertSystem(friendAccountId);
      const now = Date.now();

      expect(() =>
        db
          .insert(friendConnections)
          .values({
            id: crypto.randomUUID(),
            systemId,
            friendSystemId,
            status: "invalid-status" as "pending",
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow();
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const friendAccountId = insertAccount();
      const friendSystemId = insertSystem(friendAccountId);
      const connId = insertFriendConnection(systemId, friendSystemId);

      db.delete(systems).where(eq(systems.id, systemId)).run();
      const rows = db
        .select()
        .from(friendConnections)
        .where(eq(friendConnections.id, connId))
        .all();
      expect(rows).toHaveLength(0);
    });

    it("rejects self-friendship via CHECK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        db
          .insert(friendConnections)
          .values({
            id: crypto.randomUUID(),
            systemId,
            friendSystemId: systemId,
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow();
    });

    it("rejects duplicate (systemId, friendSystemId)", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const friendAccountId = insertAccount();
      const friendSystemId = insertSystem(friendAccountId);
      const now = Date.now();

      insertFriendConnection(systemId, friendSystemId);

      expect(() =>
        db
          .insert(friendConnections)
          .values({
            id: crypto.randomUUID(),
            systemId,
            friendSystemId,
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow();
    });
  });

  describe("friend_codes", () => {
    it("inserts and queries by code", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const code = `FC-${crypto.randomUUID()}`;
      const now = Date.now();

      db.insert(friendCodes)
        .values({
          id,
          systemId,
          code,
          createdAt: now,
        })
        .run();

      const rows = db.select().from(friendCodes).where(eq(friendCodes.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.code).toBe(code);
      expect(rows[0]?.systemId).toBe(systemId);
    });

    it("allows nullable expiresAt", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(friendCodes)
        .values({
          id,
          systemId,
          code: `FC-${crypto.randomUUID()}`,
          createdAt: now,
        })
        .run();

      const rows = db.select().from(friendCodes).where(eq(friendCodes.id, id)).all();
      expect(rows[0]?.expiresAt).toBeNull();
    });

    it("rejects duplicate code", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const code = `FC-${crypto.randomUUID()}`;
      const now = Date.now();

      db.insert(friendCodes)
        .values({
          id: crypto.randomUUID(),
          systemId,
          code,
          createdAt: now,
        })
        .run();

      expect(() =>
        db
          .insert(friendCodes)
          .values({
            id: crypto.randomUUID(),
            systemId,
            code,
            createdAt: now,
          })
          .run(),
      ).toThrow();
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(friendCodes)
        .values({
          id,
          systemId,
          code: `FC-${crypto.randomUUID()}`,
          createdAt: now,
        })
        .run();

      db.delete(systems).where(eq(systems.id, systemId)).run();
      const rows = db.select().from(friendCodes).where(eq(friendCodes.id, id)).all();
      expect(rows).toHaveLength(0);
    });

    it("rejects code shorter than 8 characters via CHECK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        db
          .insert(friendCodes)
          .values({
            id: crypto.randomUUID(),
            systemId,
            code: "SHORT",
            createdAt: now,
          })
          .run(),
      ).toThrow();
    });

    it("accepts code exactly 8 characters", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      db.insert(friendCodes)
        .values({
          id: crypto.randomUUID(),
          systemId,
          code: `E8CH${crypto.randomUUID().slice(0, 4)}`,
          createdAt: now,
        })
        .run();
    });

    it("rejects expiresAt === createdAt via CHECK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        db
          .insert(friendCodes)
          .values({
            id: crypto.randomUUID(),
            systemId,
            code: `FC-${crypto.randomUUID()}`,
            createdAt: now,
            expiresAt: now,
          })
          .run(),
      ).toThrow();
    });

    it("rejects expiresAt <= createdAt via CHECK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        db
          .insert(friendCodes)
          .values({
            id: crypto.randomUUID(),
            systemId,
            code: `FC-${crypto.randomUUID()}`,
            createdAt: now,
            expiresAt: now - 1000,
          })
          .run(),
      ).toThrow();
    });
  });

  describe("friend_bucket_assignments", () => {
    it("inserts and queries by composite PK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const friendAccountId = insertAccount();
      const friendSystemId = insertSystem(friendAccountId);
      const bucketId = insertBucket(systemId);
      const connId = insertFriendConnection(systemId, friendSystemId);

      db.insert(friendBucketAssignments)
        .values({
          friendConnectionId: connId,
          bucketId,
        })
        .run();

      const rows = db
        .select()
        .from(friendBucketAssignments)
        .where(eq(friendBucketAssignments.friendConnectionId, connId))
        .all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.bucketId).toBe(bucketId);
    });

    it("cascades on connection deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const friendAccountId = insertAccount();
      const friendSystemId = insertSystem(friendAccountId);
      const bucketId = insertBucket(systemId);
      const connId = insertFriendConnection(systemId, friendSystemId);

      db.insert(friendBucketAssignments)
        .values({
          friendConnectionId: connId,
          bucketId,
        })
        .run();

      db.delete(friendConnections).where(eq(friendConnections.id, connId)).run();
      const rows = db
        .select()
        .from(friendBucketAssignments)
        .where(eq(friendBucketAssignments.friendConnectionId, connId))
        .all();
      expect(rows).toHaveLength(0);
    });

    it("cascades on bucket deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const friendAccountId = insertAccount();
      const friendSystemId = insertSystem(friendAccountId);
      const bucketId = insertBucket(systemId);
      const connId = insertFriendConnection(systemId, friendSystemId);

      db.insert(friendBucketAssignments)
        .values({
          friendConnectionId: connId,
          bucketId,
        })
        .run();

      db.delete(buckets).where(eq(buckets.id, bucketId)).run();
      const rows = db
        .select()
        .from(friendBucketAssignments)
        .where(eq(friendBucketAssignments.bucketId, bucketId))
        .all();
      expect(rows).toHaveLength(0);
    });

    it("composite PK prevents duplicates", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const friendAccountId = insertAccount();
      const friendSystemId = insertSystem(friendAccountId);
      const bucketId = insertBucket(systemId);
      const connId = insertFriendConnection(systemId, friendSystemId);

      db.insert(friendBucketAssignments)
        .values({
          friendConnectionId: connId,
          bucketId,
        })
        .run();

      expect(() =>
        db
          .insert(friendBucketAssignments)
          .values({
            friendConnectionId: connId,
            bucketId,
          })
          .run(),
      ).toThrow();
    });

    it("rejects nonexistent friendConnectionId FK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const bucketId = insertBucket(systemId);

      expect(() =>
        db
          .insert(friendBucketAssignments)
          .values({
            friendConnectionId: "nonexistent",
            bucketId,
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("rejects nonexistent bucketId FK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const friendAccountId = insertAccount();
      const friendSystemId = insertSystem(friendAccountId);
      const connId = insertFriendConnection(systemId, friendSystemId);

      expect(() =>
        db
          .insert(friendBucketAssignments)
          .values({
            friendConnectionId: connId,
            bucketId: "nonexistent",
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });
  });
});
