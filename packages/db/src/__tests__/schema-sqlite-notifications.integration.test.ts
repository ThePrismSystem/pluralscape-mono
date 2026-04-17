import Database from "better-sqlite3-multiple-ciphers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/sqlite/auth.js";
import {
  deviceTokens,
  friendNotificationPreferences,
  notificationConfigs,
} from "../schema/sqlite/notifications.js";
import { friendConnections } from "../schema/sqlite/privacy.js";
import { systems } from "../schema/sqlite/systems.js";

import {
  createSqliteNotificationTables,
  sqliteInsertAccount,
  sqliteInsertSystem,
} from "./helpers/sqlite-helpers.js";

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = {
  accounts,
  systems,
  friendConnections,
  deviceTokens,
  notificationConfigs,
  friendNotificationPreferences,
};

describe("SQLite notifications schema", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  const insertAccount = (id?: string): string => sqliteInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string): string =>
    sqliteInsertSystem(db, accountId, id);

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
    db.delete(notificationConfigs).run();
    db.delete(deviceTokens).run();
    db.delete(friendConnections).run();
  });

  describe("device_tokens", () => {
    it("round-trips all fields", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(deviceTokens)
        .values({
          id,
          accountId,
          systemId,
          platform: "ios",
          tokenHash: "abc123def456abc123def456abc123def456abc123def456abc123def456abcd",
          createdAt: now,
          lastActiveAt: now,
        })
        .run();

      const rows = db.select().from(deviceTokens).where(eq(deviceTokens.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.platform).toBe("ios");
      expect(rows[0]?.tokenHash).toBe(
        "abc123def456abc123def456abc123def456abc123def456abc123def456abcd",
      );
      expect(rows[0]?.revokedAt).toBeNull();
    });

    it("allows nullable lastActiveAt and revokedAt", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(deviceTokens)
        .values({
          id,
          accountId,
          systemId,
          platform: "android",
          tokenHash: `tokenHash-${crypto.randomUUID()}`.slice(0, 64),
          createdAt: now,
        })
        .run();

      const rows = db.select().from(deviceTokens).where(eq(deviceTokens.id, id)).all();
      expect(rows[0]?.lastActiveAt).toBeNull();
      expect(rows[0]?.revokedAt).toBeNull();
    });

    it("rejects invalid platform", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            `INSERT INTO device_tokens (id, account_id, system_id, platform, token_hash, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .run(crypto.randomUUID(), accountId, systemId, "invalid-platform", "tok", now),
      ).toThrow();
    });

    it("rejects duplicate tokenHash+platform pair", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();
      const tokenHash = "abc123def456abc123def456abc123def456abc123def456abc123def456abcd";

      db.insert(deviceTokens)
        .values({
          id: crypto.randomUUID(),
          accountId,
          systemId,
          platform: "ios",
          tokenHash,
          createdAt: now,
        })
        .run();

      expect(() =>
        db
          .insert(deviceTokens)
          .values({
            id: crypto.randomUUID(),
            accountId,
            systemId,
            platform: "ios",
            tokenHash,
            createdAt: now,
          })
          .run(),
      ).toThrow();
    });

    it("allows same tokenHash on different platforms", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();
      const tokenHash = "abc123def456abc123def456abc123def456abc123def456abc123def456abcd";

      db.insert(deviceTokens)
        .values({
          id: crypto.randomUUID(),
          accountId,
          systemId,
          platform: "ios",
          tokenHash,
          createdAt: now,
        })
        .run();

      db.insert(deviceTokens)
        .values({
          id: crypto.randomUUID(),
          accountId,
          systemId,
          platform: "android",
          tokenHash,
          createdAt: now,
        })
        .run();
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(deviceTokens)
        .values({
          id,
          accountId,
          systemId,
          platform: "web",
          tokenHash: `tokenHash-${crypto.randomUUID()}`.slice(0, 64),
          createdAt: now,
        })
        .run();

      db.delete(systems).where(eq(systems.id, systemId)).run();
      const rows = db.select().from(deviceTokens).where(eq(deviceTokens.id, id)).all();
      expect(rows).toHaveLength(0);
    });

    it("cascades on account deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(deviceTokens)
        .values({
          id,
          accountId,
          systemId,
          platform: "ios",
          tokenHash: `tokenHash-${crypto.randomUUID()}`.slice(0, 64),
          createdAt: now,
        })
        .run();

      db.delete(accounts).where(eq(accounts.id, accountId)).run();
      const rows = db.select().from(deviceTokens).where(eq(deviceTokens.id, id)).all();
      expect(rows).toHaveLength(0);
    });
  });

  describe("notification_configs", () => {
    it("round-trips with fail-closed defaults (enabled=false, push_enabled=false)", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(notificationConfigs)
        .values({
          id,
          systemId,
          eventType: "switch-reminder",
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db
        .select()
        .from(notificationConfigs)
        .where(eq(notificationConfigs.id, id))
        .all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.enabled).toBe(false);
      expect(rows[0]?.pushEnabled).toBe(false);
    });

    it("enforces unique (system_id, event_type)", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      db.insert(notificationConfigs)
        .values({
          id: crypto.randomUUID(),
          systemId,
          eventType: "check-in-due",
          createdAt: now,
          updatedAt: now,
        })
        .run();

      expect(() =>
        db
          .insert(notificationConfigs)
          .values({
            id: crypto.randomUUID(),
            systemId,
            eventType: "check-in-due",
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow();
    });

    it("rejects invalid event_type", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            `INSERT INTO notification_configs (id, system_id, event_type, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?)`,
          )
          .run(crypto.randomUUID(), systemId, "invalid-event-type", now, now),
      ).toThrow();
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(notificationConfigs)
        .values({
          id,
          systemId,
          eventType: "message-received",
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.delete(systems).where(eq(systems.id, systemId)).run();
      const rows = db
        .select()
        .from(notificationConfigs)
        .where(eq(notificationConfigs.id, id))
        .all();
      expect(rows).toHaveLength(0);
    });

    it("stores enabled and pushEnabled as false correctly", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(notificationConfigs)
        .values({
          id,
          systemId,
          eventType: "sync-conflict",
          enabled: false,
          pushEnabled: false,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db
        .select()
        .from(notificationConfigs)
        .where(eq(notificationConfigs.id, id))
        .all();
      expect(rows[0]?.enabled).toBe(false);
      expect(rows[0]?.pushEnabled).toBe(false);
    });

    it("defaults archived to false and archivedAt to null", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(notificationConfigs)
        .values({ id, systemId, eventType: "switch-reminder", createdAt: now, updatedAt: now })
        .run();

      const rows = db
        .select()
        .from(notificationConfigs)
        .where(eq(notificationConfigs.id, id))
        .all();
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("round-trips archived: true with archivedAt timestamp", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(notificationConfigs)
        .values({
          id,
          systemId,
          eventType: "check-in-due",
          archived: true,
          archivedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db
        .select()
        .from(notificationConfigs)
        .where(eq(notificationConfigs.id, id))
        .all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("rejects archived=true with archivedAt=null via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            "INSERT INTO notification_configs (id, system_id, event_type, enabled, push_enabled, created_at, updated_at, archived, archived_at) VALUES (?, ?, 'switch-reminder', 1, 1, ?, ?, 1, NULL)",
          )
          .run(crypto.randomUUID(), systemId, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("rejects archived=false with archivedAt set via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            "INSERT INTO notification_configs (id, system_id, event_type, enabled, push_enabled, created_at, updated_at, archived, archived_at) VALUES (?, ?, 'switch-reminder', 1, 1, ?, ?, 0, ?)",
          )
          .run(crypto.randomUUID(), systemId, now, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("updates archived from false to true", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(notificationConfigs)
        .values({
          id,
          systemId,
          eventType: "switch-reminder",
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.update(notificationConfigs)
        .set({ archived: true, archivedAt: now, updatedAt: now })
        .where(eq(notificationConfigs.id, id))
        .run();

      const rows = db
        .select()
        .from(notificationConfigs)
        .where(eq(notificationConfigs.id, id))
        .all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("allows duplicate (systemId, eventType) when both rows are archived", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      db.insert(notificationConfigs)
        .values({
          id: crypto.randomUUID(),
          systemId,
          eventType: "switch-reminder",
          archived: true,
          archivedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.insert(notificationConfigs)
        .values({
          id: crypto.randomUUID(),
          systemId,
          eventType: "switch-reminder",
          archived: true,
          archivedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    });

    it("rejects duplicate (systemId, eventType) when both rows are active", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      db.insert(notificationConfigs)
        .values({
          id: crypto.randomUUID(),
          systemId,
          eventType: "switch-reminder",
          createdAt: now,
          updatedAt: now,
        })
        .run();

      expect(() =>
        db
          .insert(notificationConfigs)
          .values({
            id: crypto.randomUUID(),
            systemId,
            eventType: "switch-reminder",
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow();
    });
  });

  describe("friend_notification_preferences", () => {
    it("round-trips with enabledEventTypes JSON", () => {
      const accountId = insertAccount();
      insertSystem(accountId);
      const friendAccountId = insertAccount();
      const fcId = crypto.randomUUID();
      const id = crypto.randomUUID();
      const now = Date.now();

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
      const fcId = crypto.randomUUID();
      const id = crypto.randomUUID();
      const now = Date.now();

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
      const fcId = crypto.randomUUID();
      const now = Date.now();

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

      db.insert(friendNotificationPreferences)
        .values({
          id: crypto.randomUUID(),
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
            id: crypto.randomUUID(),
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
      const fcId = crypto.randomUUID();
      const id = crypto.randomUUID();
      const now = Date.now();

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
      const fcId = crypto.randomUUID();
      const id = crypto.randomUUID();
      const now = Date.now();

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
      const fcId = crypto.randomUUID();
      const now = Date.now();

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
      const fcId = crypto.randomUUID();
      const now = Date.now();

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
      const fcId = crypto.randomUUID();
      const id = crypto.randomUUID();
      const now = Date.now();

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
      const fcId = crypto.randomUUID();
      const now = Date.now();

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

      db.insert(friendNotificationPreferences)
        .values({
          id: crypto.randomUUID(),
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
          id: crypto.randomUUID(),
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
      const fcId = crypto.randomUUID();
      const now = Date.now();

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

      db.insert(friendNotificationPreferences)
        .values({
          id: crypto.randomUUID(),
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
            id: crypto.randomUUID(),
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
