import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

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
        lastUsedAt: now,
      });

      const rows = await db.select().from(deviceTokens).where(eq(deviceTokens.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.platform).toBe("ios");
      expect(rows[0]?.token).toBe("fcm-token-abc");
      expect(rows[0]?.revokedAt).toBeNull();
    });

    it("allows nullable lastUsedAt and revokedAt", async () => {
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
      expect(rows[0]?.lastUsedAt).toBeNull();
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
  });

  describe("friend_notification_preferences", () => {
    it("round-trips with enabledEventTypes JSON", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const fcId = crypto.randomUUID();
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(friendConnections).values({
        id: fcId,
        systemId,
        friendSystemId: await insertSystem(accountId),
        status: "accepted",
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(friendNotificationPreferences).values({
        id,
        systemId,
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

    it("enforces unique (system_id, friend_connection_id)", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const friendSystemId = await insertSystem(accountId);
      const fcId = crypto.randomUUID();
      const now = Date.now();

      await db.insert(friendConnections).values({
        id: fcId,
        systemId,
        friendSystemId,
        status: "accepted",
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(friendNotificationPreferences).values({
        id: crypto.randomUUID(),
        systemId,
        friendConnectionId: fcId,
        enabledEventTypes: [],
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        db.insert(friendNotificationPreferences).values({
          id: crypto.randomUUID(),
          systemId,
          friendConnectionId: fcId,
          enabledEventTypes: [],
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });
  });
});
