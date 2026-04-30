/**
 * SQLite privacy schema — key_grants and friend_connections tables.
 *
 * Covers: key_grants (6 tests), friend_connections (12 tests) = 18 tests.
 *
 * Source: schema-sqlite-privacy.integration.test.ts (lines 442–873)
 */

import { brandId } from "@pluralscape/types";
import Database from "better-sqlite3-multiple-ciphers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/sqlite/auth.js";
import { buckets, friendConnections, keyGrants } from "../schema/sqlite/privacy.js";
import { systems } from "../schema/sqlite/systems.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import {
  createSqlitePrivacyTables,
  sqliteInsertAccount,
  sqliteInsertSystem,
  testBlob,
} from "./helpers/sqlite-helpers.js";

import type {
  AccountId,
  BucketId,
  FriendConnectionId,
  KeyGrantId,
  SystemId,
} from "@pluralscape/types";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = { accounts, systems, buckets, keyGrants, friendConnections };

describe("SQLite privacy schema — key_grants and friend_connections", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  const insertAccount = (id?: string) => sqliteInsertAccount(db, id);
  const insertSystem = (accountId: AccountId, id?: string) => sqliteInsertSystem(db, accountId, id);

  function insertBucket(systemId: SystemId): BucketId {
    const id = brandId<BucketId>(crypto.randomUUID());
    const now = fixtureNow();
    db.insert(buckets)
      .values({ id, systemId, encryptedData: testBlob(), createdAt: now, updatedAt: now })
      .run();
    return id;
  }

  function insertFriendConnection(
    accountId: AccountId,
    friendAccountId: AccountId,
  ): FriendConnectionId {
    const id = brandId<FriendConnectionId>(crypto.randomUUID());
    const now = fixtureNow();
    db.insert(friendConnections)
      .values({ id, accountId, friendAccountId, createdAt: now, updatedAt: now })
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
    db.delete(keyGrants).run();
    db.delete(friendConnections).run();
    db.delete(buckets).run();
  });

  describe("key_grants", () => {
    it("inserts with encrypted_key and round-trips binary", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const bucketId = insertBucket(systemId);
      const friendAccountId = insertAccount();
      insertSystem(friendAccountId);
      const id = brandId<KeyGrantId>(crypto.randomUUID());
      const now = fixtureNow();
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
      const id = brandId<KeyGrantId>(crypto.randomUUID());
      const now = fixtureNow();

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
      const grantId = brandId<KeyGrantId>(crypto.randomUUID());
      const now = fixtureNow();

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
      const now = fixtureNow();

      expect(() =>
        db
          .insert(keyGrants)
          .values({
            id: brandId<KeyGrantId>(crypto.randomUUID()),
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
      const now = fixtureNow();

      db.insert(keyGrants)
        .values({
          id: brandId<KeyGrantId>(crypto.randomUUID()),
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
            id: brandId<KeyGrantId>(crypto.randomUUID()),
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
      const now = fixtureNow();

      expect(() =>
        db
          .insert(keyGrants)
          .values({
            id: brandId<KeyGrantId>(crypto.randomUUID()),
            bucketId,
            systemId,
            friendAccountId: brandId<AccountId>("nonexistent"),
            encryptedKey: new Uint8Array([1]),
            keyVersion: 1,
            createdAt: now,
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });
  });

  // ── friend_connections ─────────────────────────────────────────────

  describe("friend_connections", () => {
    it("inserts with defaults and round-trips", () => {
      const accountId = insertAccount();
      insertSystem(accountId);
      const friendAccountId = insertAccount();
      insertSystem(friendAccountId);
      const id = brandId<FriendConnectionId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(friendConnections)
        .values({ id, accountId, friendAccountId, createdAt: now, updatedAt: now })
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
      const now = fixtureNow();

      expect(() =>
        db
          .insert(friendConnections)
          .values({
            id: brandId<FriendConnectionId>(crypto.randomUUID()),
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
      const now = fixtureNow();

      expect(() =>
        db
          .insert(friendConnections)
          .values({
            id: brandId<FriendConnectionId>(crypto.randomUUID()),
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
      const now = fixtureNow();

      insertFriendConnection(accountId, friendAccountId);

      expect(() =>
        db
          .insert(friendConnections)
          .values({
            id: brandId<FriendConnectionId>(crypto.randomUUID()),
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
      const id = insertFriendConnection(accountId, friendAccountId);
      const rows = db.select().from(friendConnections).where(eq(friendConnections.id, id)).all();
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("round-trips archived: true with archivedAt", () => {
      const accountId = insertAccount();
      insertSystem(accountId);
      const friendAccountId = insertAccount();
      insertSystem(friendAccountId);
      const id = brandId<FriendConnectionId>(crypto.randomUUID());
      const now = fixtureNow();

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
      const now = fixtureNow();

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
      const now = fixtureNow();

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
      const now = fixtureNow();

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
      const now = fixtureNow();

      db.insert(friendConnections)
        .values({
          id: brandId<FriendConnectionId>(crypto.randomUUID()),
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
          id: brandId<FriendConnectionId>(crypto.randomUUID()),
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
      const now = fixtureNow();

      db.insert(friendConnections)
        .values({
          id: brandId<FriendConnectionId>(crypto.randomUUID()),
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
            id: brandId<FriendConnectionId>(crypto.randomUUID()),
            accountId,
            friendAccountId,
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow();
    });
  });
});
