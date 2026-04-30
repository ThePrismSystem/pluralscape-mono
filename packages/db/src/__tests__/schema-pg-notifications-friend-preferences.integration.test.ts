import { brandId } from "@pluralscape/types";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { friendNotificationPreferences } from "../schema/pg/notifications.js";
import { friendConnections } from "../schema/pg/privacy.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import {
  clearNotificationsTables,
  insertAccount as insertAccountWith,
  insertSystem as insertSystemWith,
  setupNotificationsFixture,
  teardownNotificationsFixture,
  type NotificationsDb,
} from "./helpers/notifications-fixtures.js";

import type { PGlite } from "@electric-sql/pglite";
import type {
  AccountId,
  FriendConnectionId,
  FriendNotificationPreferenceId,
} from "@pluralscape/types";

describe("PG notifications schema — friend notification preferences", () => {
  let client: PGlite;
  let db: NotificationsDb;

  const insertAccount = (id?: string) => insertAccountWith(db, id);
  const insertSystem = (accountId: AccountId, id?: string) => insertSystemWith(db, accountId, id);

  beforeAll(async () => {
    const fixture = await setupNotificationsFixture();
    client = fixture.client;
    db = fixture.db;
  });

  afterAll(async () => {
    await teardownNotificationsFixture({ client, db });
  });

  afterEach(async () => {
    await clearNotificationsTables(db);
  });

  describe("friend_notification_preferences", () => {
    it("round-trips with enabledEventTypes JSON", async () => {
      const accountId = await insertAccount();
      await insertSystem(accountId);
      const fcId = brandId<FriendConnectionId>(crypto.randomUUID());
      const id = brandId<FriendNotificationPreferenceId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(friendConnections).values({
        id: fcId,
        accountId,
        friendAccountId: await insertAccount(),
        status: "accepted",
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(friendNotificationPreferences).values({
        id,
        accountId,
        friendConnectionId: fcId,
        enabledEventTypes: ["friend-switch-alert"],
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db
        .select()
        .from(friendNotificationPreferences)
        .where(eq(friendNotificationPreferences.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.enabledEventTypes).toEqual(["friend-switch-alert"]);
    });

    it("restricts friend_connection deletion when referenced by preference", async () => {
      const accountId = await insertAccount();
      await insertSystem(accountId);
      const fcId = brandId<FriendConnectionId>(crypto.randomUUID());
      const id = brandId<FriendNotificationPreferenceId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(friendConnections).values({
        id: fcId,
        accountId,
        friendAccountId: await insertAccount(),
        status: "accepted",
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(friendNotificationPreferences).values({
        id,
        accountId,
        friendConnectionId: fcId,
        enabledEventTypes: ["friend-switch-alert"],
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        db.delete(friendConnections).where(eq(friendConnections.id, fcId)),
      ).rejects.toThrow();
    });

    it("enforces unique (account_id, friend_connection_id)", async () => {
      const accountId = await insertAccount();
      await insertSystem(accountId);
      const friendAccountId = await insertAccount();
      const fcId = brandId<FriendConnectionId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(friendConnections).values({
        id: fcId,
        accountId,
        friendAccountId,
        status: "accepted",
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(friendNotificationPreferences).values({
        id: brandId<FriendNotificationPreferenceId>(crypto.randomUUID()),
        accountId,
        friendConnectionId: fcId,
        enabledEventTypes: [],
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        db.insert(friendNotificationPreferences).values({
          id: brandId<FriendNotificationPreferenceId>(crypto.randomUUID()),
          accountId,
          friendConnectionId: fcId,
          enabledEventTypes: [],
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("defaults archived to false and archivedAt to null", async () => {
      const accountId = await insertAccount();
      await insertSystem(accountId);
      const fcId = brandId<FriendConnectionId>(crypto.randomUUID());
      const id = brandId<FriendNotificationPreferenceId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(friendConnections).values({
        id: fcId,
        accountId,
        friendAccountId: await insertAccount(),
        status: "accepted",
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(friendNotificationPreferences).values({
        id,
        accountId,
        friendConnectionId: fcId,
        enabledEventTypes: [],
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db
        .select()
        .from(friendNotificationPreferences)
        .where(eq(friendNotificationPreferences.id, id));
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("round-trips archived: true with archivedAt timestamp", async () => {
      const accountId = await insertAccount();
      await insertSystem(accountId);
      const fcId = brandId<FriendConnectionId>(crypto.randomUUID());
      const id = brandId<FriendNotificationPreferenceId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(friendConnections).values({
        id: fcId,
        accountId,
        friendAccountId: await insertAccount(),
        status: "accepted",
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(friendNotificationPreferences).values({
        id,
        accountId,
        friendConnectionId: fcId,
        enabledEventTypes: [],
        archived: true,
        archivedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db
        .select()
        .from(friendNotificationPreferences)
        .where(eq(friendNotificationPreferences.id, id));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("updates archived from false to true", async () => {
      const accountId = await insertAccount();
      await insertSystem(accountId);
      const fcId = brandId<FriendConnectionId>(crypto.randomUUID());
      const id = brandId<FriendNotificationPreferenceId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(friendConnections).values({
        id: fcId,
        accountId,
        friendAccountId: await insertAccount(),
        status: "accepted",
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(friendNotificationPreferences).values({
        id,
        accountId,
        friendConnectionId: fcId,
        enabledEventTypes: [],
        createdAt: now,
        updatedAt: now,
      });

      const updateNow = fixtureNow();
      await db
        .update(friendNotificationPreferences)
        .set({ archived: true, archivedAt: updateNow })
        .where(eq(friendNotificationPreferences.id, id));
      const rows = await db
        .select()
        .from(friendNotificationPreferences)
        .where(eq(friendNotificationPreferences.id, id));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(updateNow);
    });

    it("allows duplicate (accountId, friendConnectionId) when both rows are archived", async () => {
      const accountId = await insertAccount();
      await insertSystem(accountId);
      const friendAccountId = await insertAccount();
      const fcId = brandId<FriendConnectionId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(friendConnections).values({
        id: fcId,
        accountId,
        friendAccountId,
        status: "accepted",
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(friendNotificationPreferences).values({
        id: brandId<FriendNotificationPreferenceId>(crypto.randomUUID()),
        accountId,
        friendConnectionId: fcId,
        enabledEventTypes: [],
        archived: true,
        archivedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(friendNotificationPreferences).values({
        id: brandId<FriendNotificationPreferenceId>(crypto.randomUUID()),
        accountId,
        friendConnectionId: fcId,
        enabledEventTypes: [],
        archived: true,
        archivedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    });

    it("rejects duplicate (accountId, friendConnectionId) when both rows are active", async () => {
      const accountId = await insertAccount();
      await insertSystem(accountId);
      const friendAccountId = await insertAccount();
      const fcId = brandId<FriendConnectionId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(friendConnections).values({
        id: fcId,
        accountId,
        friendAccountId,
        status: "accepted",
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(friendNotificationPreferences).values({
        id: brandId<FriendNotificationPreferenceId>(crypto.randomUUID()),
        accountId,
        friendConnectionId: fcId,
        enabledEventTypes: [],
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        db.insert(friendNotificationPreferences).values({
          id: brandId<FriendNotificationPreferenceId>(crypto.randomUUID()),
          accountId,
          friendConnectionId: fcId,
          enabledEventTypes: [],
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("rejects archived=true with archivedAt=null via CHECK constraint", async () => {
      const accountId = await insertAccount();
      await insertSystem(accountId);
      const fcId = brandId<FriendConnectionId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(friendConnections).values({
        id: fcId,
        accountId,
        friendAccountId: await insertAccount(),
        status: "accepted",
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        client.query(
          "INSERT INTO friend_notification_preferences (id, account_id, friend_connection_id, enabled_event_types, created_at, updated_at, archived, archived_at) VALUES ($1, $2, $3, '[]', $4, $5, true, NULL)",
          [crypto.randomUUID(), accountId, fcId, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });

    it("rejects archived=false with archivedAt set via CHECK constraint", async () => {
      const accountId = await insertAccount();
      await insertSystem(accountId);
      const fcId = brandId<FriendConnectionId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(friendConnections).values({
        id: fcId,
        accountId,
        friendAccountId: await insertAccount(),
        status: "accepted",
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        client.query(
          "INSERT INTO friend_notification_preferences (id, account_id, friend_connection_id, enabled_event_types, created_at, updated_at, archived, archived_at) VALUES ($1, $2, $3, '[]', $4, $5, false, $6)",
          [crypto.randomUUID(), accountId, fcId, now, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });
  });
});
