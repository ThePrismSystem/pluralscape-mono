import Database from "better-sqlite3-multiple-ciphers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

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

  const insertAccount = (id?: string) => sqliteInsertAccount(db, id);
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
    accountId: string,
    friendAccountId: string,
    id = crypto.randomUUID(),
  ): string {
    const now = Date.now();
    db.insert(friendConnections)
      .values({
        id,
        accountId,
        friendAccountId,
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

  afterEach(() => {
    db.delete(friendBucketAssignments).run();
    db.delete(keyGrants).run();
    db.delete(friendCodes).run();
    db.delete(friendConnections).run();
    db.delete(bucketContentTags).run();
    db.delete(buckets).run();
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

    it("defaults archived to false and archivedAt to null", () => {
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
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("round-trips archived: true with archivedAt", () => {
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
          archived: true,
          archivedAt: now,
        })
        .run();

      const rows = db.select().from(buckets).where(eq(buckets.id, id)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("rejects archived=true with archivedAt=null via CHECK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

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
      const now = Date.now();

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
      const now = Date.now();

      db.update(buckets)
        .set({ archived: true, archivedAt: now, updatedAt: now })
        .where(eq(buckets.id, id))
        .run();

      const rows = db.select().from(buckets).where(eq(buckets.id, id)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("updates archived from true back to false (unarchival)", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = insertBucket(systemId);
      const now = Date.now();

      db.update(buckets)
        .set({ archived: true, archivedAt: now, updatedAt: now })
        .where(eq(buckets.id, id))
        .run();

      const unarchiveNow = Date.now();
      db.update(buckets)
        .set({ archived: false, archivedAt: null, updatedAt: unarchiveNow })
        .where(eq(buckets.id, id))
        .run();

      const rows = db.select().from(buckets).where(eq(buckets.id, id)).all();
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
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
          systemId,
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
          systemId,
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
            systemId,
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
          systemId,
        })
        .run();

      expect(() =>
        db
          .insert(bucketContentTags)
          .values({
            entityType: "note",
            entityId,
            bucketId,
            systemId,
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
            systemId: "nonexistent",
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
            systemId,
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
      insertSystem(friendAccountId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const keyData = new Uint8Array([99, 88, 77, 66]);

      db.insert(keyGrants)
        .values({
          id,
          bucketId,
          systemId,
          friendAccountId,
          encryptedKey: keyData,
          keyVersion: 1,
          createdAt: now,
        })
        .run();

      const rows = db.select().from(keyGrants).where(eq(keyGrants.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedKey).toEqual(keyData);
      expect(rows[0]?.bucketId).toBe(bucketId);
      expect(rows[0]?.friendAccountId).toBe(friendAccountId);
      expect(rows[0]?.keyVersion).toBe(1);
    });

    it("allows nullable revokedAt", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const bucketId = insertBucket(systemId);
      const friendAccountId = insertAccount();
      insertSystem(friendAccountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(keyGrants)
        .values({
          id,
          bucketId,
          systemId,
          friendAccountId,
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
      insertSystem(friendAccountId);
      const grantId = crypto.randomUUID();
      const now = Date.now();

      db.insert(keyGrants)
        .values({
          id: grantId,
          bucketId,
          systemId,
          friendAccountId,
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
      insertSystem(friendAccountId);
      const now = Date.now();

      expect(() =>
        db
          .insert(keyGrants)
          .values({
            id: crypto.randomUUID(),
            bucketId,
            systemId,
            friendAccountId,
            encryptedKey: new Uint8Array([1]),
            keyVersion: 0,
            createdAt: now,
          })
          .run(),
      ).toThrow();
    });

    it("rejects duplicate (bucketId, friendAccountId, keyVersion)", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const bucketId = insertBucket(systemId);
      const friendAccountId = insertAccount();
      insertSystem(friendAccountId);
      const now = Date.now();

      db.insert(keyGrants)
        .values({
          id: crypto.randomUUID(),
          bucketId,
          systemId,
          friendAccountId,
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
            systemId,
            friendAccountId,
            encryptedKey: new Uint8Array([2]),
            keyVersion: 1,
            createdAt: now,
          })
          .run(),
      ).toThrow();
    });

    it("rejects nonexistent friendAccountId FK", () => {
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
            systemId,
            friendAccountId: "nonexistent",
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
      insertSystem(accountId);
      const friendAccountId = insertAccount();
      insertSystem(friendAccountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(friendConnections)
        .values({
          id,
          accountId,
          friendAccountId,
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
      insertSystem(accountId);
      const friendAccountId = insertAccount();
      insertSystem(friendAccountId);
      const now = Date.now();

      expect(() =>
        db
          .insert(friendConnections)
          .values({
            id: crypto.randomUUID(),
            accountId,
            friendAccountId,
            status: "invalid-status" as "pending",
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow();
    });

    it("cascades on account deletion", () => {
      const accountId = insertAccount();
      insertSystem(accountId);
      const friendAccountId = insertAccount();
      insertSystem(friendAccountId);
      const connId = insertFriendConnection(accountId, friendAccountId);

      db.delete(accounts).where(eq(accounts.id, accountId)).run();
      const rows = db
        .select()
        .from(friendConnections)
        .where(eq(friendConnections.id, connId))
        .all();
      expect(rows).toHaveLength(0);
    });

    it("rejects self-friendship via CHECK", () => {
      const accountId = insertAccount();
      insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        db
          .insert(friendConnections)
          .values({
            id: crypto.randomUUID(),
            accountId,
            friendAccountId: accountId,
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow();
    });

    it("rejects duplicate (accountId, friendAccountId)", () => {
      const accountId = insertAccount();
      insertSystem(accountId);
      const friendAccountId = insertAccount();
      insertSystem(friendAccountId);
      const now = Date.now();

      insertFriendConnection(accountId, friendAccountId);

      expect(() =>
        db
          .insert(friendConnections)
          .values({
            id: crypto.randomUUID(),
            accountId,
            friendAccountId,
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow();
    });

    it("defaults archived to false and archivedAt to null", () => {
      const accountId = insertAccount();
      insertSystem(accountId);
      const friendAccountId = insertAccount();
      insertSystem(friendAccountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(friendConnections)
        .values({
          id,
          accountId,
          friendAccountId,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(friendConnections).where(eq(friendConnections.id, id)).all();
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("round-trips archived: true with archivedAt", () => {
      const accountId = insertAccount();
      insertSystem(accountId);
      const friendAccountId = insertAccount();
      insertSystem(friendAccountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(friendConnections)
        .values({
          id,
          accountId,
          friendAccountId,
          createdAt: now,
          updatedAt: now,
          archived: true,
          archivedAt: now,
        })
        .run();

      const rows = db.select().from(friendConnections).where(eq(friendConnections.id, id)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("rejects archived=true with archivedAt=null via CHECK", () => {
      const accountId = insertAccount();
      insertSystem(accountId);
      const friendAccountId = insertAccount();
      insertSystem(friendAccountId);
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            "INSERT INTO friend_connections (id, account_id, friend_account_id, status, created_at, updated_at, version, archived, archived_at) VALUES (?, ?, ?, 'pending', ?, ?, 1, 1, NULL)",
          )
          .run(crypto.randomUUID(), accountId, friendAccountId, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("rejects archived=false with archivedAt set via CHECK", () => {
      const accountId = insertAccount();
      insertSystem(accountId);
      const friendAccountId = insertAccount();
      insertSystem(friendAccountId);
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            "INSERT INTO friend_connections (id, account_id, friend_account_id, status, created_at, updated_at, version, archived, archived_at) VALUES (?, ?, ?, 'pending', ?, ?, 1, 0, ?)",
          )
          .run(crypto.randomUUID(), accountId, friendAccountId, now, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("updates archived from false to true", () => {
      const accountId = insertAccount();
      insertSystem(accountId);
      const friendAccountId = insertAccount();
      insertSystem(friendAccountId);
      const id = insertFriendConnection(accountId, friendAccountId);
      const now = Date.now();

      db.update(friendConnections)
        .set({ archived: true, archivedAt: now, updatedAt: now })
        .where(eq(friendConnections.id, id))
        .run();

      const rows = db.select().from(friendConnections).where(eq(friendConnections.id, id)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("allows duplicate (accountId, friendAccountId) when both rows are archived", () => {
      const accountId = insertAccount();
      insertSystem(accountId);
      const friendAccountId = insertAccount();
      insertSystem(friendAccountId);
      const now = Date.now();

      db.insert(friendConnections)
        .values({
          id: crypto.randomUUID(),
          accountId,
          friendAccountId,
          createdAt: now,
          updatedAt: now,
          archived: true,
          archivedAt: now,
        })
        .run();

      db.insert(friendConnections)
        .values({
          id: crypto.randomUUID(),
          accountId,
          friendAccountId,
          createdAt: now,
          updatedAt: now,
          archived: true,
          archivedAt: now,
        })
        .run();
    });

    it("rejects duplicate (accountId, friendAccountId) when both rows are active", () => {
      const accountId = insertAccount();
      insertSystem(accountId);
      const friendAccountId = insertAccount();
      insertSystem(friendAccountId);
      const now = Date.now();

      db.insert(friendConnections)
        .values({
          id: crypto.randomUUID(),
          accountId,
          friendAccountId,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      expect(() =>
        db
          .insert(friendConnections)
          .values({
            id: crypto.randomUUID(),
            accountId,
            friendAccountId,
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
      insertSystem(accountId);
      const id = crypto.randomUUID();
      const code = `FC-${crypto.randomUUID()}`;
      const now = Date.now();

      db.insert(friendCodes)
        .values({
          id,
          accountId,
          code,
          createdAt: now,
        })
        .run();

      const rows = db.select().from(friendCodes).where(eq(friendCodes.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.code).toBe(code);
      expect(rows[0]?.accountId).toBe(accountId);
    });

    it("allows nullable expiresAt", () => {
      const accountId = insertAccount();
      insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(friendCodes)
        .values({
          id,
          accountId,
          code: `FC-${crypto.randomUUID()}`,
          createdAt: now,
        })
        .run();

      const rows = db.select().from(friendCodes).where(eq(friendCodes.id, id)).all();
      expect(rows[0]?.expiresAt).toBeNull();
    });

    it("rejects duplicate code", () => {
      const accountId = insertAccount();
      insertSystem(accountId);
      const code = `FC-${crypto.randomUUID()}`;
      const now = Date.now();

      db.insert(friendCodes)
        .values({
          id: crypto.randomUUID(),
          accountId,
          code,
          createdAt: now,
        })
        .run();

      expect(() =>
        db
          .insert(friendCodes)
          .values({
            id: crypto.randomUUID(),
            accountId,
            code,
            createdAt: now,
          })
          .run(),
      ).toThrow();
    });

    it("cascades on account deletion", () => {
      const accountId = insertAccount();
      insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(friendCodes)
        .values({
          id,
          accountId,
          code: `FC-${crypto.randomUUID()}`,
          createdAt: now,
        })
        .run();

      db.delete(accounts).where(eq(accounts.id, accountId)).run();
      const rows = db.select().from(friendCodes).where(eq(friendCodes.id, id)).all();
      expect(rows).toHaveLength(0);
    });

    it("rejects code shorter than 8 characters via CHECK", () => {
      const accountId = insertAccount();
      insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        db
          .insert(friendCodes)
          .values({
            id: crypto.randomUUID(),
            accountId,
            code: "SHORT",
            createdAt: now,
          })
          .run(),
      ).toThrow();
    });

    it("accepts code exactly 8 characters", () => {
      const accountId = insertAccount();
      insertSystem(accountId);
      const now = Date.now();

      db.insert(friendCodes)
        .values({
          id: crypto.randomUUID(),
          accountId,
          code: `E8CH${crypto.randomUUID().slice(0, 4)}`,
          createdAt: now,
        })
        .run();
    });

    it("rejects expiresAt === createdAt via CHECK", () => {
      const accountId = insertAccount();
      insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        db
          .insert(friendCodes)
          .values({
            id: crypto.randomUUID(),
            accountId,
            code: `FC-${crypto.randomUUID()}`,
            createdAt: now,
            expiresAt: now,
          })
          .run(),
      ).toThrow();
    });

    it("rejects expiresAt <= createdAt via CHECK", () => {
      const accountId = insertAccount();
      insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        db
          .insert(friendCodes)
          .values({
            id: crypto.randomUUID(),
            accountId,
            code: `FC-${crypto.randomUUID()}`,
            createdAt: now,
            expiresAt: now - 1000,
          })
          .run(),
      ).toThrow();
    });

    it("defaults archived to false and archivedAt to null", () => {
      const accountId = insertAccount();
      insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(friendCodes)
        .values({
          id,
          accountId,
          code: `FC-${crypto.randomUUID()}`,
          createdAt: now,
        })
        .run();

      const rows = db.select().from(friendCodes).where(eq(friendCodes.id, id)).all();
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("round-trips archived: true with archivedAt", () => {
      const accountId = insertAccount();
      insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(friendCodes)
        .values({
          id,
          accountId,
          code: `FC-${crypto.randomUUID()}`,
          createdAt: now,
          archived: true,
          archivedAt: now,
        })
        .run();

      const rows = db.select().from(friendCodes).where(eq(friendCodes.id, id)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("rejects archived=true with archivedAt=null via CHECK", () => {
      const accountId = insertAccount();
      insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            "INSERT INTO friend_codes (id, account_id, code, created_at, archived, archived_at) VALUES (?, ?, ?, ?, 1, NULL)",
          )
          .run(crypto.randomUUID(), accountId, `FC-${crypto.randomUUID()}`, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("rejects archived=false with archivedAt set via CHECK", () => {
      const accountId = insertAccount();
      insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            "INSERT INTO friend_codes (id, account_id, code, created_at, archived, archived_at) VALUES (?, ?, ?, ?, 0, ?)",
          )
          .run(crypto.randomUUID(), accountId, `FC-${crypto.randomUUID()}`, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("updates archived from false to true", () => {
      const accountId = insertAccount();
      insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(friendCodes)
        .values({
          id,
          accountId,
          code: `FC-${crypto.randomUUID()}`,
          createdAt: now,
        })
        .run();

      db.update(friendCodes)
        .set({ archived: true, archivedAt: now })
        .where(eq(friendCodes.id, id))
        .run();

      const rows = db.select().from(friendCodes).where(eq(friendCodes.id, id)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("allows duplicate code when both rows are archived", () => {
      const accountId = insertAccount();
      insertSystem(accountId);
      const code = `FC-${crypto.randomUUID()}`;
      const now = Date.now();

      db.insert(friendCodes)
        .values({
          id: crypto.randomUUID(),
          accountId,
          code,
          createdAt: now,
          archived: true,
          archivedAt: now,
        })
        .run();

      db.insert(friendCodes)
        .values({
          id: crypto.randomUUID(),
          accountId,
          code,
          createdAt: now,
          archived: true,
          archivedAt: now,
        })
        .run();

      const rows = db.select().from(friendCodes).where(eq(friendCodes.code, code)).all();
      expect(rows).toHaveLength(2);
    });

    it("allows reuse of archived code for a new active entry", () => {
      const accountId = insertAccount();
      insertSystem(accountId);
      const code = `FC-${crypto.randomUUID()}`;
      const now = Date.now();

      db.insert(friendCodes)
        .values({
          id: crypto.randomUUID(),
          accountId,
          code,
          createdAt: now,
          archived: true,
          archivedAt: now,
        })
        .run();

      db.insert(friendCodes)
        .values({
          id: crypto.randomUUID(),
          accountId,
          code,
          createdAt: now,
        })
        .run();

      const rows = db.select().from(friendCodes).where(eq(friendCodes.code, code)).all();
      expect(rows).toHaveLength(2);
      expect(rows.filter((r) => !r.archived)).toHaveLength(1);
    });
  });

  describe("friend_bucket_assignments", () => {
    it("inserts and queries by composite PK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const friendAccountId = insertAccount();
      insertSystem(friendAccountId);
      const bucketId = insertBucket(systemId);
      const connId = insertFriendConnection(accountId, friendAccountId);

      db.insert(friendBucketAssignments)
        .values({
          friendConnectionId: connId,
          bucketId,
          systemId,
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
      insertSystem(friendAccountId);
      const bucketId = insertBucket(systemId);
      const connId = insertFriendConnection(accountId, friendAccountId);

      db.insert(friendBucketAssignments)
        .values({
          friendConnectionId: connId,
          bucketId,
          systemId,
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
      insertSystem(friendAccountId);
      const bucketId = insertBucket(systemId);
      const connId = insertFriendConnection(accountId, friendAccountId);

      db.insert(friendBucketAssignments)
        .values({
          friendConnectionId: connId,
          bucketId,
          systemId,
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
      insertSystem(friendAccountId);
      const bucketId = insertBucket(systemId);
      const connId = insertFriendConnection(accountId, friendAccountId);

      db.insert(friendBucketAssignments)
        .values({
          friendConnectionId: connId,
          bucketId,
          systemId,
        })
        .run();

      expect(() =>
        db
          .insert(friendBucketAssignments)
          .values({
            friendConnectionId: connId,
            bucketId,
            systemId,
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
            systemId,
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("rejects nonexistent bucketId FK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const friendAccountId = insertAccount();
      insertSystem(friendAccountId);
      const connId = insertFriendConnection(accountId, friendAccountId);

      expect(() =>
        db
          .insert(friendBucketAssignments)
          .values({
            friendConnectionId: connId,
            bucketId: "nonexistent",
            systemId,
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });
  });
});
