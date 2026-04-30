import { brandId } from "@pluralscape/types";
import { eq, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/pg/auth.js";
import { friendConnections } from "../schema/pg/privacy.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import {
  clearPrivacyTables,
  insertAccount as insertAccountWith,
  insertFriendConnection as insertFriendConnectionWith,
  insertSystem as insertSystemWith,
  setupPrivacyFixture,
  teardownPrivacyFixture,
  type PrivacyDb,
} from "./helpers/privacy-fixtures.js";

import type { PGlite } from "@electric-sql/pglite";
import type { AccountId, FriendConnectionId } from "@pluralscape/types";

describe("PG privacy schema — friend connections", () => {
  let client: PGlite;
  let db: PrivacyDb;

  const insertAccount = (id?: string) => insertAccountWith(db, id);
  const insertSystem = (accountId: AccountId, id?: string) => insertSystemWith(db, accountId, id);
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
});
