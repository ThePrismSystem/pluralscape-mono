/**
 * SQLite privacy schema — friend_codes and friend_bucket_assignments tables.
 *
 * Covers: friend_codes (14 tests), friend_bucket_assignments (6 tests) = 20 tests.
 *
 * Source: schema-sqlite-privacy.integration.test.ts (lines 875–1335)
 */

import { brandId, toUnixMillis } from "@pluralscape/types";
import Database from "better-sqlite3-multiple-ciphers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/sqlite/auth.js";
import {
  buckets,
  friendBucketAssignments,
  friendCodes,
  friendConnections,
} from "../schema/sqlite/privacy.js";
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
  FriendCodeId,
  FriendConnectionId,
  SystemId,
} from "@pluralscape/types";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = {
  accounts,
  systems,
  buckets,
  friendConnections,
  friendCodes,
  friendBucketAssignments,
};

describe("SQLite privacy schema — friend_codes and friend_bucket_assignments", () => {
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
    db.delete(friendBucketAssignments).run();
    db.delete(friendCodes).run();
    db.delete(friendConnections).run();
    db.delete(buckets).run();
  });

  describe("friend_codes", () => {
    it("inserts and queries by code", () => {
      const accountId = insertAccount();
      insertSystem(accountId);
      const id = brandId<FriendCodeId>(crypto.randomUUID());
      const code = `FC-${crypto.randomUUID()}`;
      const now = fixtureNow();

      db.insert(friendCodes).values({ id, accountId, code, createdAt: now }).run();

      const rows = db.select().from(friendCodes).where(eq(friendCodes.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.code).toBe(code);
      expect(rows[0]?.accountId).toBe(accountId);
    });

    it("allows nullable expiresAt", () => {
      const accountId = insertAccount();
      insertSystem(accountId);
      const id = brandId<FriendCodeId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(friendCodes)
        .values({ id, accountId, code: `FC-${crypto.randomUUID()}`, createdAt: now })
        .run();

      const rows = db.select().from(friendCodes).where(eq(friendCodes.id, id)).all();
      expect(rows[0]?.expiresAt).toBeNull();
    });

    it("rejects duplicate code", () => {
      const accountId = insertAccount();
      insertSystem(accountId);
      const code = `FC-${crypto.randomUUID()}`;
      const now = fixtureNow();

      db.insert(friendCodes)
        .values({ id: brandId<FriendCodeId>(crypto.randomUUID()), accountId, code, createdAt: now })
        .run();

      expect(() =>
        db
          .insert(friendCodes)
          .values({
            id: brandId<FriendCodeId>(crypto.randomUUID()),
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
      const id = brandId<FriendCodeId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(friendCodes)
        .values({ id, accountId, code: `FC-${crypto.randomUUID()}`, createdAt: now })
        .run();

      db.delete(accounts).where(eq(accounts.id, accountId)).run();
      const rows = db.select().from(friendCodes).where(eq(friendCodes.id, id)).all();
      expect(rows).toHaveLength(0);
    });

    it("rejects code shorter than 8 characters via CHECK", () => {
      const accountId = insertAccount();
      insertSystem(accountId);
      const now = fixtureNow();

      expect(() =>
        db
          .insert(friendCodes)
          .values({
            id: brandId<FriendCodeId>(crypto.randomUUID()),
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
      const now = fixtureNow();

      db.insert(friendCodes)
        .values({
          id: brandId<FriendCodeId>(crypto.randomUUID()),
          accountId,
          code: `E8CH${crypto.randomUUID().slice(0, 4)}`,
          createdAt: now,
        })
        .run();
    });

    it("rejects expiresAt === createdAt via CHECK", () => {
      const accountId = insertAccount();
      insertSystem(accountId);
      const now = fixtureNow();

      expect(() =>
        db
          .insert(friendCodes)
          .values({
            id: brandId<FriendCodeId>(crypto.randomUUID()),
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
      const now = fixtureNow();

      expect(() =>
        db
          .insert(friendCodes)
          .values({
            id: brandId<FriendCodeId>(crypto.randomUUID()),
            accountId,
            code: `FC-${crypto.randomUUID()}`,
            createdAt: now,
            expiresAt: toUnixMillis(now - 1000),
          })
          .run(),
      ).toThrow();
    });

    it("defaults archived to false and archivedAt to null", () => {
      const accountId = insertAccount();
      insertSystem(accountId);
      const id = brandId<FriendCodeId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(friendCodes)
        .values({ id, accountId, code: `FC-${crypto.randomUUID()}`, createdAt: now })
        .run();

      const rows = db.select().from(friendCodes).where(eq(friendCodes.id, id)).all();
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("round-trips archived: true with archivedAt", () => {
      const accountId = insertAccount();
      insertSystem(accountId);
      const id = brandId<FriendCodeId>(crypto.randomUUID());
      const now = fixtureNow();

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
      const now = fixtureNow();

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
      const now = fixtureNow();

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
      const id = brandId<FriendCodeId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(friendCodes)
        .values({ id, accountId, code: `FC-${crypto.randomUUID()}`, createdAt: now })
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
      const now = fixtureNow();

      db.insert(friendCodes)
        .values({
          id: brandId<FriendCodeId>(crypto.randomUUID()),
          accountId,
          code,
          createdAt: now,
          archived: true,
          archivedAt: now,
        })
        .run();
      db.insert(friendCodes)
        .values({
          id: brandId<FriendCodeId>(crypto.randomUUID()),
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
      const now = fixtureNow();

      db.insert(friendCodes)
        .values({
          id: brandId<FriendCodeId>(crypto.randomUUID()),
          accountId,
          code,
          createdAt: now,
          archived: true,
          archivedAt: now,
        })
        .run();
      db.insert(friendCodes)
        .values({ id: brandId<FriendCodeId>(crypto.randomUUID()), accountId, code, createdAt: now })
        .run();

      const rows = db.select().from(friendCodes).where(eq(friendCodes.code, code)).all();
      expect(rows).toHaveLength(2);
      expect(rows.filter((r) => !r.archived)).toHaveLength(1);
    });
  });

  // ── friend_bucket_assignments ──────────────────────────────────────

  describe("friend_bucket_assignments", () => {
    it("inserts and queries by composite PK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const friendAccountId = insertAccount();
      insertSystem(friendAccountId);
      const bucketId = insertBucket(systemId);
      const connId = insertFriendConnection(accountId, friendAccountId);

      db.insert(friendBucketAssignments)
        .values({ friendConnectionId: connId, bucketId, systemId })
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
        .values({ friendConnectionId: connId, bucketId, systemId })
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
        .values({ friendConnectionId: connId, bucketId, systemId })
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
        .values({ friendConnectionId: connId, bucketId, systemId })
        .run();

      expect(() =>
        db
          .insert(friendBucketAssignments)
          .values({ friendConnectionId: connId, bucketId, systemId })
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
            friendConnectionId: brandId<FriendConnectionId>("nonexistent"),
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
            bucketId: brandId<BucketId>("nonexistent"),
            systemId,
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });
  });
});
