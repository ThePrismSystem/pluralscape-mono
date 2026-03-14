import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/pg/auth.js";
import {
  deviceTokens,
  friendNotificationPreferences,
  notificationConfigs,
} from "../schema/pg/notifications.js";
import { friendConnections } from "../schema/pg/privacy.js";
import { systems } from "../schema/pg/systems.js";

import {
  createPgNotificationTables,
  pgInsertAccount,
  pgInsertSystem,
} from "./helpers/pg-helpers.js";

import type { PgliteDatabase } from "drizzle-orm/pglite";

const schema = {
  accounts,
  systems,
  friendConnections,
  deviceTokens,
  notificationConfigs,
  friendNotificationPreferences,
};

describe("PG notifications schema", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;

  const insertAccount = (id?: string) => pgInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string) => pgInsertSystem(db, accountId, id);

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgNotificationTables(client);
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(friendNotificationPreferences);
    await db.delete(notificationConfigs);
    await db.delete(deviceTokens);
  });

  describe("device_tokens", () => {
    it("round-trips all fields", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(deviceTokens).values({
        id,
        accountId,
        systemId,
        platform: "ios",
        token: "fcm-token-abc",
        createdAt: now,
        lastActiveAt: now,
      });

      const rows = await db.select().from(deviceTokens).where(eq(deviceTokens.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.platform).toBe("ios");
      expect(rows[0]?.token).toBe("fcm-token-abc");
      expect(rows[0]?.revokedAt).toBeNull();
    });

    it("allows nullable lastActiveAt and revokedAt", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(deviceTokens).values({
        id,
        accountId,
        systemId,
        platform: "android",
        token: `token-${crypto.randomUUID()}`,
        createdAt: now,
      });

      const rows = await db.select().from(deviceTokens).where(eq(deviceTokens.id, id));
      expect(rows[0]?.lastActiveAt).toBeNull();
      expect(rows[0]?.revokedAt).toBeNull();
    });

    it("rejects invalid platform values", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await expect(
        db.insert(deviceTokens).values({
          id: crypto.randomUUID(),
          accountId,
          systemId,
          platform: "desktop" as "ios",
          token: "tok",
          createdAt: now,
        }),
      ).rejects.toThrow();
    });

    it("rejects duplicate token+platform pair", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();
      const token = `token-${crypto.randomUUID()}`;

      await db.insert(deviceTokens).values({
        id: crypto.randomUUID(),
        accountId,
        systemId,
        platform: "ios",
        token,
        createdAt: now,
      });

      await expect(
        db.insert(deviceTokens).values({
          id: crypto.randomUUID(),
          accountId,
          systemId,
          platform: "ios",
          token,
          createdAt: now,
        }),
      ).rejects.toThrow();
    });

    it("allows same token on different platforms", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();
      const token = `token-${crypto.randomUUID()}`;

      await db.insert(deviceTokens).values({
        id: crypto.randomUUID(),
        accountId,
        systemId,
        platform: "ios",
        token,
        createdAt: now,
      });

      await db.insert(deviceTokens).values({
        id: crypto.randomUUID(),
        accountId,
        systemId,
        platform: "android",
        token,
        createdAt: now,
      });
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(deviceTokens).values({
        id,
        accountId,
        systemId,
        platform: "web",
        token: `token-${crypto.randomUUID()}`,
        createdAt: now,
      });

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db.select().from(deviceTokens).where(eq(deviceTokens.id, id));
      expect(rows).toHaveLength(0);
    });

    it("cascades on account deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(deviceTokens).values({
        id,
        accountId,
        systemId,
        platform: "ios",
        token: `token-${crypto.randomUUID()}`,
        createdAt: now,
      });

      await db.delete(accounts).where(eq(accounts.id, accountId));
      const rows = await db.select().from(deviceTokens).where(eq(deviceTokens.id, id));
      expect(rows).toHaveLength(0);
    });
  });

  describe("notification_configs", () => {
    it("round-trips with defaults", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(notificationConfigs).values({
        id,
        systemId,
        eventType: "switch-reminder",
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db
        .select()
        .from(notificationConfigs)
        .where(eq(notificationConfigs.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.enabled).toBe(true);
      expect(rows[0]?.pushEnabled).toBe(true);
    });

    it("enforces unique (system_id, event_type)", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await db.insert(notificationConfigs).values({
        id: crypto.randomUUID(),
        systemId,
        eventType: "check-in-due",
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        db.insert(notificationConfigs).values({
          id: crypto.randomUUID(),
          systemId,
          eventType: "check-in-due",
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(notificationConfigs).values({
        id,
        systemId,
        eventType: "message-received",
        createdAt: now,
        updatedAt: now,
      });

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db
        .select()
        .from(notificationConfigs)
        .where(eq(notificationConfigs.id, id));
      expect(rows).toHaveLength(0);
    });

    it("rejects invalid event_type", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await expect(
        db.insert(notificationConfigs).values({
          id: crypto.randomUUID(),
          systemId,
          eventType: "invalid-event" as "switch-reminder",
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("stores enabled and pushEnabled as false correctly", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(notificationConfigs).values({
        id,
        systemId,
        eventType: "sync-conflict",
        enabled: false,
        pushEnabled: false,
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db
        .select()
        .from(notificationConfigs)
        .where(eq(notificationConfigs.id, id));
      expect(rows[0]?.enabled).toBe(false);
      expect(rows[0]?.pushEnabled).toBe(false);
    });

    it("defaults archived to false and archivedAt to null", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(notificationConfigs).values({
        id,
        systemId,
        eventType: "switch-reminder",
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db
        .select()
        .from(notificationConfigs)
        .where(eq(notificationConfigs.id, id));
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("round-trips archived: true with archivedAt timestamp", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(notificationConfigs).values({
        id,
        systemId,
        eventType: "check-in-due",
        archived: true,
        archivedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db
        .select()
        .from(notificationConfigs)
        .where(eq(notificationConfigs.id, id));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("updates archived from false to true", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(notificationConfigs).values({
        id,
        systemId,
        eventType: "switch-reminder",
        createdAt: now,
        updatedAt: now,
      });

      const updateNow = Date.now();
      await db
        .update(notificationConfigs)
        .set({ archived: true, archivedAt: updateNow })
        .where(eq(notificationConfigs.id, id));
      const rows = await db
        .select()
        .from(notificationConfigs)
        .where(eq(notificationConfigs.id, id));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(updateNow);
    });

    it("allows duplicate (systemId, eventType) when both rows are archived", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await db.insert(notificationConfigs).values({
        id: crypto.randomUUID(),
        systemId,
        eventType: "switch-reminder",
        archived: true,
        archivedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(notificationConfigs).values({
        id: crypto.randomUUID(),
        systemId,
        eventType: "switch-reminder",
        archived: true,
        archivedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    });

    it("rejects duplicate (systemId, eventType) when both rows are active", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await db.insert(notificationConfigs).values({
        id: crypto.randomUUID(),
        systemId,
        eventType: "switch-reminder",
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        db.insert(notificationConfigs).values({
          id: crypto.randomUUID(),
          systemId,
          eventType: "switch-reminder",
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("rejects archived=true with archivedAt=null via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await expect(
        client.query(
          "INSERT INTO notification_configs (id, system_id, event_type, enabled, push_enabled, created_at, updated_at, archived, archived_at) VALUES ($1, $2, 'switch-reminder', true, true, $3, $4, true, NULL)",
          [crypto.randomUUID(), systemId, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });

    it("rejects archived=false with archivedAt set via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await expect(
        client.query(
          "INSERT INTO notification_configs (id, system_id, event_type, enabled, push_enabled, created_at, updated_at, archived, archived_at) VALUES ($1, $2, 'switch-reminder', true, true, $3, $4, false, $5)",
          [crypto.randomUUID(), systemId, now, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });
  });

  describe("friend_notification_preferences", () => {
    it("round-trips with enabledEventTypes JSON", async () => {
      const accountId = await insertAccount();
      await insertSystem(accountId);
      const fcId = crypto.randomUUID();
      const id = crypto.randomUUID();
      const now = Date.now();

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

    it("cascades on friend_connection deletion", async () => {
      const accountId = await insertAccount();
      await insertSystem(accountId);
      const fcId = crypto.randomUUID();
      const id = crypto.randomUUID();
      const now = Date.now();

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

      await db.delete(friendConnections).where(eq(friendConnections.id, fcId));
      const rows = await db
        .select()
        .from(friendNotificationPreferences)
        .where(eq(friendNotificationPreferences.id, id));
      expect(rows).toHaveLength(0);
    });

    it("enforces unique (account_id, friend_connection_id)", async () => {
      const accountId = await insertAccount();
      await insertSystem(accountId);
      const friendAccountId = await insertAccount();
      const fcId = crypto.randomUUID();
      const now = Date.now();

      await db.insert(friendConnections).values({
        id: fcId,
        accountId,
        friendAccountId,
        status: "accepted",
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(friendNotificationPreferences).values({
        id: crypto.randomUUID(),
        accountId,
        friendConnectionId: fcId,
        enabledEventTypes: [],
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        db.insert(friendNotificationPreferences).values({
          id: crypto.randomUUID(),
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
      const fcId = crypto.randomUUID();
      const id = crypto.randomUUID();
      const now = Date.now();

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
      const fcId = crypto.randomUUID();
      const id = crypto.randomUUID();
      const now = Date.now();

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
      const fcId = crypto.randomUUID();
      const id = crypto.randomUUID();
      const now = Date.now();

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

      const updateNow = Date.now();
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
      const fcId = crypto.randomUUID();
      const now = Date.now();

      await db.insert(friendConnections).values({
        id: fcId,
        accountId,
        friendAccountId,
        status: "accepted",
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(friendNotificationPreferences).values({
        id: crypto.randomUUID(),
        accountId,
        friendConnectionId: fcId,
        enabledEventTypes: [],
        archived: true,
        archivedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(friendNotificationPreferences).values({
        id: crypto.randomUUID(),
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
      const fcId = crypto.randomUUID();
      const now = Date.now();

      await db.insert(friendConnections).values({
        id: fcId,
        accountId,
        friendAccountId,
        status: "accepted",
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(friendNotificationPreferences).values({
        id: crypto.randomUUID(),
        accountId,
        friendConnectionId: fcId,
        enabledEventTypes: [],
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        db.insert(friendNotificationPreferences).values({
          id: crypto.randomUUID(),
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
      const fcId = crypto.randomUUID();
      const now = Date.now();

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
      const fcId = crypto.randomUUID();
      const now = Date.now();

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
