/**
 * SQLite notifications schema — friend_notification_preferences table.
 *
 * Covers: friend_notification_preferences lifecycle, unique constraints,
 *   archival, cascade on friend_connection deletion = 9 tests.
 *
 * Source: schema-sqlite-notifications.integration.test.ts (lines 524–914)
 */

import { brandId } from "@pluralscape/types";
import Database from "better-sqlite3-multiple-ciphers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/sqlite/auth.js";
import { friendNotificationPreferences } from "../schema/sqlite/notifications.js";
import { friendConnections } from "../schema/sqlite/privacy.js";
import { systems } from "../schema/sqlite/systems.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import {
  createSqliteNotificationTables,
  sqliteInsertAccount,
  sqliteInsertSystem,
} from "./helpers/sqlite-helpers.js";

import type {
  AccountId,
  FriendConnectionId,
  FriendNotificationPreferenceId,
} from "@pluralscape/types";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = { accounts, systems, friendConnections, friendNotificationPreferences };

describe("SQLite notifications schema — friend_notification_preferences", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  const insertAccount = (id?: string) => sqliteInsertAccount(db, id);
  const insertSystem = (accountId: AccountId, id?: string) => sqliteInsertSystem(db, accountId, id);

  function insertFriendConnection(
    accountId: AccountId,
    friendAccountId: AccountId,
  ): FriendConnectionId {
    const fcId = brandId<FriendConnectionId>(crypto.randomUUID());
    const now = fixtureNow();
    db.insert(friendConnections)
      .values({
        id: fcId,
        accountId,
        friendAccountId,
        status: "accepted",
        createdAt: now,
        updatedAt: now,
      })
      .run();
    return fcId;
  }

  beforeAll(() => {
    client = new Database(":memory:");
    client.pragma("foreign_keys = ON");
    db = drizzle(client, { schema });
    createSqliteNotificationTables(client);
  });

  afterAll(() => {
    client.close();
  });

  afterEach(() => {
    db.delete(friendNotificationPreferences).run();
    db.delete(friendConnections).run();
  });

  describe("friend_notification_preferences", () => {
    it("round-trips with enabledEventTypes JSON", () => {
      const accountId = insertAccount();
      insertSystem(accountId);
      const friendAccountId = insertAccount();
      const fcId = insertFriendConnection(accountId, friendAccountId);
      const id = brandId<FriendNotificationPreferenceId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(friendNotificationPreferences)
        .values({
          id,
          accountId,
          friendConnectionId: fcId,
          enabledEventTypes: ["friend-switch-alert"],
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db
        .select()
        .from(friendNotificationPreferences)
        .where(eq(friendNotificationPreferences.id, id))
        .all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.enabledEventTypes).toEqual(["friend-switch-alert"]);
    });

    it("cascades on friend_connection deletion", () => {
      const accountId = insertAccount();
      insertSystem(accountId);
      const friendAccountId = insertAccount();
      const fcId = insertFriendConnection(accountId, friendAccountId);
      const id = brandId<FriendNotificationPreferenceId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(friendNotificationPreferences)
        .values({
          id,
          accountId,
          friendConnectionId: fcId,
          enabledEventTypes: ["friend-switch-alert"],
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.delete(friendConnections).where(eq(friendConnections.id, fcId)).run();
      const rows = db
        .select()
        .from(friendNotificationPreferences)
        .where(eq(friendNotificationPreferences.id, id))
        .all();
      expect(rows).toHaveLength(0);
    });

    it("enforces unique (account_id, friend_connection_id)", () => {
      const accountId = insertAccount();
      insertSystem(accountId);
      const friendAccountId = insertAccount();
      const fcId = insertFriendConnection(accountId, friendAccountId);
      const now = fixtureNow();

      db.insert(friendNotificationPreferences)
        .values({
          id: brandId<FriendNotificationPreferenceId>(crypto.randomUUID()),
          accountId,
          friendConnectionId: fcId,
          enabledEventTypes: [],
          createdAt: now,
          updatedAt: now,
        })
        .run();

      expect(() =>
        db
          .insert(friendNotificationPreferences)
          .values({
            id: brandId<FriendNotificationPreferenceId>(crypto.randomUUID()),
            accountId,
            friendConnectionId: fcId,
            enabledEventTypes: [],
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
      const fcId = insertFriendConnection(accountId, friendAccountId);
      const id = brandId<FriendNotificationPreferenceId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(friendNotificationPreferences)
        .values({
          id,
          accountId,
          friendConnectionId: fcId,
          enabledEventTypes: [],
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db
        .select()
        .from(friendNotificationPreferences)
        .where(eq(friendNotificationPreferences.id, id))
        .all();
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("round-trips archived: true with archivedAt timestamp", () => {
      const accountId = insertAccount();
      insertSystem(accountId);
      const friendAccountId = insertAccount();
      const fcId = insertFriendConnection(accountId, friendAccountId);
      const id = brandId<FriendNotificationPreferenceId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(friendNotificationPreferences)
        .values({
          id,
          accountId,
          friendConnectionId: fcId,
          enabledEventTypes: [],
          archived: true,
          archivedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db
        .select()
        .from(friendNotificationPreferences)
        .where(eq(friendNotificationPreferences.id, id))
        .all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("rejects archived=true with archivedAt=null via CHECK constraint", () => {
      const accountId = insertAccount();
      insertSystem(accountId);
      const friendAccountId = insertAccount();
      const fcId = insertFriendConnection(accountId, friendAccountId);
      const now = fixtureNow();

      expect(() =>
        client
          .prepare(
            "INSERT INTO friend_notification_preferences (id, account_id, friend_connection_id, enabled_event_types, created_at, updated_at, archived, archived_at) VALUES (?, ?, ?, '[]', ?, ?, 1, NULL)",
          )
          .run(crypto.randomUUID(), accountId, fcId, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("rejects archived=false with archivedAt set via CHECK constraint", () => {
      const accountId = insertAccount();
      insertSystem(accountId);
      const friendAccountId = insertAccount();
      const fcId = insertFriendConnection(accountId, friendAccountId);
      const now = fixtureNow();

      expect(() =>
        client
          .prepare(
            "INSERT INTO friend_notification_preferences (id, account_id, friend_connection_id, enabled_event_types, created_at, updated_at, archived, archived_at) VALUES (?, ?, ?, '[]', ?, ?, 0, ?)",
          )
          .run(crypto.randomUUID(), accountId, fcId, now, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("updates archived from false to true", () => {
      const accountId = insertAccount();
      insertSystem(accountId);
      const friendAccountId = insertAccount();
      const fcId = insertFriendConnection(accountId, friendAccountId);
      const id = brandId<FriendNotificationPreferenceId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(friendNotificationPreferences)
        .values({
          id,
          accountId,
          friendConnectionId: fcId,
          enabledEventTypes: [],
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.update(friendNotificationPreferences)
        .set({ archived: true, archivedAt: now, updatedAt: now })
        .where(eq(friendNotificationPreferences.id, id))
        .run();

      const rows = db
        .select()
        .from(friendNotificationPreferences)
        .where(eq(friendNotificationPreferences.id, id))
        .all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("allows duplicate (accountId, friendConnectionId) when both rows are archived", () => {
      const accountId = insertAccount();
      insertSystem(accountId);
      const friendAccountId = insertAccount();
      const fcId = insertFriendConnection(accountId, friendAccountId);
      const now = fixtureNow();

      db.insert(friendNotificationPreferences)
        .values({
          id: brandId<FriendNotificationPreferenceId>(crypto.randomUUID()),
          accountId,
          friendConnectionId: fcId,
          enabledEventTypes: [],
          archived: true,
          archivedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.insert(friendNotificationPreferences)
        .values({
          id: brandId<FriendNotificationPreferenceId>(crypto.randomUUID()),
          accountId,
          friendConnectionId: fcId,
          enabledEventTypes: [],
          archived: true,
          archivedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    });

    it("rejects duplicate (accountId, friendConnectionId) when both rows are active", () => {
      const accountId = insertAccount();
      insertSystem(accountId);
      const friendAccountId = insertAccount();
      const fcId = insertFriendConnection(accountId, friendAccountId);
      const now = fixtureNow();

      db.insert(friendNotificationPreferences)
        .values({
          id: brandId<FriendNotificationPreferenceId>(crypto.randomUUID()),
          accountId,
          friendConnectionId: fcId,
          enabledEventTypes: [],
          createdAt: now,
          updatedAt: now,
        })
        .run();

      expect(() =>
        db
          .insert(friendNotificationPreferences)
          .values({
            id: brandId<FriendNotificationPreferenceId>(crypto.randomUUID()),
            accountId,
            friendConnectionId: fcId,
            enabledEventTypes: [],
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow();
    });
  });
});
