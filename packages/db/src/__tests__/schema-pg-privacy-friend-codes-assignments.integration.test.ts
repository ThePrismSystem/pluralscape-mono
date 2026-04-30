import { brandId, toUnixMillis } from "@pluralscape/types";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/pg/auth.js";
import {
  buckets,
  friendBucketAssignments,
  friendCodes,
  friendConnections,
} from "../schema/pg/privacy.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import {
  clearPrivacyTables,
  insertAccount as insertAccountWith,
  insertBucket as insertBucketWith,
  insertFriendConnection as insertFriendConnectionWith,
  insertSystem as insertSystemWith,
  setupPrivacyFixture,
  teardownPrivacyFixture,
  type PrivacyDb,
} from "./helpers/privacy-fixtures.js";

import type { PGlite } from "@electric-sql/pglite";
import type {
  AccountId,
  BucketId,
  FriendCodeId,
  FriendConnectionId,
  SystemId,
} from "@pluralscape/types";

describe("PG privacy schema — friend codes & bucket assignments", () => {
  let client: PGlite;
  let db: PrivacyDb;

  const insertAccount = (id?: string) => insertAccountWith(db, id);
  const insertSystem = (accountId: AccountId, id?: string) => insertSystemWith(db, accountId, id);
  const insertBucket = (systemId: SystemId, id?: BucketId): Promise<BucketId> =>
    insertBucketWith(db, systemId, id);
  const insertFriendConnection = (
    accountId: AccountId,
    friendAccountId: AccountId,
    id?: FriendConnectionId,
  ): Promise<FriendConnectionId> => insertFriendConnectionWith(db, accountId, friendAccountId, id);

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
