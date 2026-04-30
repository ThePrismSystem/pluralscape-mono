import { brandId } from "@pluralscape/types";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/pg/auth.js";
import { deviceTokens, notificationConfigs } from "../schema/pg/notifications.js";
import { systems } from "../schema/pg/systems.js";

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
import type { AccountId, DeviceTokenId, NotificationConfigId } from "@pluralscape/types";

describe("PG notifications schema — device tokens & notification configs", () => {
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

  describe("device_tokens", () => {
    it("round-trips all fields", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<DeviceTokenId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(deviceTokens).values({
        id,
        accountId,
        systemId,
        platform: "ios",
        tokenHash: "abc123def456abc123def456abc123def456abc123def456abc123def456abcd",
        createdAt: now,
        lastActiveAt: now,
      });

      const rows = await db.select().from(deviceTokens).where(eq(deviceTokens.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.platform).toBe("ios");
      expect(rows[0]?.tokenHash).toBe(
        "abc123def456abc123def456abc123def456abc123def456abc123def456abcd",
      );
      expect(rows[0]?.revokedAt).toBeNull();
    });

    it("allows nullable lastActiveAt and revokedAt", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<DeviceTokenId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(deviceTokens).values({
        id,
        accountId,
        systemId,
        platform: "android",
        tokenHash: `tokenHash-${crypto.randomUUID()}`.slice(0, 64),
        createdAt: now,
      });

      const rows = await db.select().from(deviceTokens).where(eq(deviceTokens.id, id));
      expect(rows[0]?.lastActiveAt).toBeNull();
      expect(rows[0]?.revokedAt).toBeNull();
    });

    it("rejects invalid platform values", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = fixtureNow();

      await expect(
        db.insert(deviceTokens).values({
          id: brandId<DeviceTokenId>(crypto.randomUUID()),
          accountId,
          systemId,
          platform: "desktop" as "ios",
          tokenHash: "abc123def456abc123def456abc123def456abc123def456abc123def456abcd",
          createdAt: now,
        }),
      ).rejects.toThrow();
    });

    it("rejects duplicate tokenHash+platform pair", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = fixtureNow();
      const tokenHash = "abc123def456abc123def456abc123def456abc123def456abc123def456abcd";

      await db.insert(deviceTokens).values({
        id: brandId<DeviceTokenId>(crypto.randomUUID()),
        accountId,
        systemId,
        platform: "ios",
        tokenHash,
        createdAt: now,
      });

      await expect(
        db.insert(deviceTokens).values({
          id: brandId<DeviceTokenId>(crypto.randomUUID()),
          accountId,
          systemId,
          platform: "ios",
          tokenHash,
          createdAt: now,
        }),
      ).rejects.toThrow();
    });

    it("allows same tokenHash on different platforms", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = fixtureNow();
      const tokenHash = "abc123def456abc123def456abc123def456abc123def456abc123def456abcd";

      await db.insert(deviceTokens).values({
        id: brandId<DeviceTokenId>(crypto.randomUUID()),
        accountId,
        systemId,
        platform: "ios",
        tokenHash,
        createdAt: now,
      });

      await db.insert(deviceTokens).values({
        id: brandId<DeviceTokenId>(crypto.randomUUID()),
        accountId,
        systemId,
        platform: "android",
        tokenHash,
        createdAt: now,
      });
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<DeviceTokenId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(deviceTokens).values({
        id,
        accountId,
        systemId,
        platform: "web",
        tokenHash: `tokenHash-${crypto.randomUUID()}`.slice(0, 64),
        createdAt: now,
      });

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db.select().from(deviceTokens).where(eq(deviceTokens.id, id));
      expect(rows).toHaveLength(0);
    });

    it("cascades on account deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<DeviceTokenId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(deviceTokens).values({
        id,
        accountId,
        systemId,
        platform: "ios",
        tokenHash: `tokenHash-${crypto.randomUUID()}`.slice(0, 64),
        createdAt: now,
      });

      await db.delete(accounts).where(eq(accounts.id, accountId));
      const rows = await db.select().from(deviceTokens).where(eq(deviceTokens.id, id));
      expect(rows).toHaveLength(0);
    });
  });

  describe("notification_configs", () => {
    it("round-trips with fail-closed defaults (enabled=false, push_enabled=false)", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<NotificationConfigId>(crypto.randomUUID());
      const now = fixtureNow();

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
      expect(rows[0]?.enabled).toBe(false);
      expect(rows[0]?.pushEnabled).toBe(false);
    });

    it("enforces unique (system_id, event_type)", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = fixtureNow();

      await db.insert(notificationConfigs).values({
        id: brandId<NotificationConfigId>(crypto.randomUUID()),
        systemId,
        eventType: "check-in-due",
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        db.insert(notificationConfigs).values({
          id: brandId<NotificationConfigId>(crypto.randomUUID()),
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
      const id = brandId<NotificationConfigId>(crypto.randomUUID());
      const now = fixtureNow();

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
      const now = fixtureNow();

      await expect(
        db.insert(notificationConfigs).values({
          id: brandId<NotificationConfigId>(crypto.randomUUID()),
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
      const id = brandId<NotificationConfigId>(crypto.randomUUID());
      const now = fixtureNow();

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
      const id = brandId<NotificationConfigId>(crypto.randomUUID());
      const now = fixtureNow();

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
      const id = brandId<NotificationConfigId>(crypto.randomUUID());
      const now = fixtureNow();

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
      const id = brandId<NotificationConfigId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(notificationConfigs).values({
        id,
        systemId,
        eventType: "switch-reminder",
        createdAt: now,
        updatedAt: now,
      });

      const updateNow = fixtureNow();
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
      const now = fixtureNow();

      await db.insert(notificationConfigs).values({
        id: brandId<NotificationConfigId>(crypto.randomUUID()),
        systemId,
        eventType: "switch-reminder",
        archived: true,
        archivedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(notificationConfigs).values({
        id: brandId<NotificationConfigId>(crypto.randomUUID()),
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
      const now = fixtureNow();

      await db.insert(notificationConfigs).values({
        id: brandId<NotificationConfigId>(crypto.randomUUID()),
        systemId,
        eventType: "switch-reminder",
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        db.insert(notificationConfigs).values({
          id: brandId<NotificationConfigId>(crypto.randomUUID()),
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
      const now = fixtureNow();

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
      const now = fixtureNow();

      await expect(
        client.query(
          "INSERT INTO notification_configs (id, system_id, event_type, enabled, push_enabled, created_at, updated_at, archived, archived_at) VALUES ($1, $2, 'switch-reminder', true, true, $3, $4, false, $5)",
          [crypto.randomUUID(), systemId, now, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });
  });
});
