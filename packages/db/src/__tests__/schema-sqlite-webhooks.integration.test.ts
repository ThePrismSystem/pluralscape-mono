import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { apiKeys } from "../schema/sqlite/api-keys.js";
import { accounts } from "../schema/sqlite/auth.js";
import { systems } from "../schema/sqlite/systems.js";
import { webhookConfigs, webhookDeliveries } from "../schema/sqlite/webhooks.js";

import {
  createSqliteWebhookTables,
  sqliteInsertAccount,
  sqliteInsertSystem,
} from "./helpers/sqlite-helpers.js";

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = { accounts, systems, apiKeys, webhookConfigs, webhookDeliveries };

describe("SQLite webhooks schema", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  const insertAccount = (id?: string): string => sqliteInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string): string =>
    sqliteInsertSystem(db, accountId, id);

  beforeAll(() => {
    client = new Database(":memory:");
    client.pragma("foreign_keys = ON");
    db = drizzle(client, { schema });
    createSqliteWebhookTables(client);
  });

  afterAll(() => {
    client.close();
  });

  afterEach(() => {
    db.delete(webhookDeliveries).run();
    db.delete(webhookConfigs).run();
  });

  describe("webhook_configs", () => {
    it("round-trips all fields", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const secret = new Uint8Array([1, 2, 3]);

      db.insert(webhookConfigs)
        .values({
          id,
          systemId,
          url: "https://example.com/webhook",
          secret,
          eventTypes: ["member.created", "fronting.started"],
          enabled: true,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(webhookConfigs).where(eq(webhookConfigs.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.url).toBe("https://example.com/webhook");
      expect(rows[0]?.secret).toEqual(secret);
      expect(rows[0]?.eventTypes).toEqual(["member.created", "fronting.started"]);
      expect(rows[0]?.enabled).toBe(true);
      expect(rows[0]?.cryptoKeyId).toBeNull();
    });

    it("defaults enabled to true", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(webhookConfigs)
        .values({
          id,
          systemId,
          url: "https://example.com/hook",
          secret: new Uint8Array([4, 5]),
          eventTypes: [],
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(webhookConfigs).where(eq(webhookConfigs.id, id)).all();
      expect(rows[0]?.enabled).toBe(true);
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(webhookConfigs)
        .values({
          id,
          systemId,
          url: "https://example.com/del",
          secret: new Uint8Array([1]),
          eventTypes: [],
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.delete(systems).where(eq(systems.id, systemId)).run();
      const rows = db.select().from(webhookConfigs).where(eq(webhookConfigs.id, id)).all();
      expect(rows).toHaveLength(0);
    });

    it("sets crypto_key_id to NULL on api_key deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const keyId = crypto.randomUUID();
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(apiKeys)
        .values({
          id: keyId,
          accountId,
          systemId,
          name: "test-key",
          keyType: "metadata",
          tokenHash: `hash-${crypto.randomUUID()}`,
          scopes: ["read:members"],
          createdAt: now,
        })
        .run();

      db.insert(webhookConfigs)
        .values({
          id,
          systemId,
          url: "https://example.com/hook",
          secret: new Uint8Array([1]),
          eventTypes: [],
          cryptoKeyId: keyId,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.delete(apiKeys).where(eq(apiKeys.id, keyId)).run();
      const rows = db.select().from(webhookConfigs).where(eq(webhookConfigs.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.cryptoKeyId).toBeNull();
    });

    it("stores enabled as false correctly", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(webhookConfigs)
        .values({
          id,
          systemId,
          url: "https://example.com/hook",
          secret: new Uint8Array([1]),
          eventTypes: [],
          enabled: false,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(webhookConfigs).where(eq(webhookConfigs.id, id)).all();
      expect(rows[0]?.enabled).toBe(false);
    });
  });

  describe("webhook_deliveries", () => {
    let deliverySystemId: string;
    let deliveryWhId: string;

    beforeEach(() => {
      const accountId = insertAccount();
      deliverySystemId = insertSystem(accountId);
      deliveryWhId = crypto.randomUUID();
      const now = Date.now();

      db.insert(webhookConfigs)
        .values({
          id: deliveryWhId,
          systemId: deliverySystemId,
          url: "https://example.com/hook",
          secret: new Uint8Array([1]),
          eventTypes: ["member.created"],
          createdAt: now,
          updatedAt: now,
        })
        .run();
    });

    it("round-trips with defaults", () => {
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(webhookDeliveries)
        .values({
          id,
          webhookId: deliveryWhId,
          systemId: deliverySystemId,
          eventType: "member.created",
          createdAt: now,
        })
        .run();

      const rows = db.select().from(webhookDeliveries).where(eq(webhookDeliveries.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.status).toBe("pending");
      expect(rows[0]?.attemptCount).toBe(0);
      expect(rows[0]?.httpStatus).toBeNull();
      expect(rows[0]?.encryptedData).toBeNull();
    });

    it("rejects invalid event_type", () => {
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            `INSERT INTO webhook_deliveries (id, webhook_id, system_id, event_type, created_at)
             VALUES (?, ?, ?, ?, ?)`,
          )
          .run(crypto.randomUUID(), deliveryWhId, deliverySystemId, "invalid-event", now),
      ).toThrow();
    });

    it("rejects invalid status", () => {
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            `INSERT INTO webhook_deliveries (id, webhook_id, system_id, event_type, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .run(
            crypto.randomUUID(),
            deliveryWhId,
            deliverySystemId,
            "member.created",
            "invalid-status",
            now,
          ),
      ).toThrow();
    });

    it("rejects negative attempt_count", () => {
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            `INSERT INTO webhook_deliveries (id, webhook_id, system_id, event_type, attempt_count, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .run(crypto.randomUUID(), deliveryWhId, deliverySystemId, "member.created", -1, now),
      ).toThrow();
    });

    it("rejects http_status outside 100-599", () => {
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            `INSERT INTO webhook_deliveries (id, webhook_id, system_id, event_type, http_status, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .run(crypto.randomUUID(), deliveryWhId, deliverySystemId, "member.created", 99, now),
      ).toThrow();

      expect(() =>
        client
          .prepare(
            `INSERT INTO webhook_deliveries (id, webhook_id, system_id, event_type, http_status, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .run(crypto.randomUUID(), deliveryWhId, deliverySystemId, "member.created", 600, now),
      ).toThrow();
    });

    it("cascades on system deletion", () => {
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(webhookDeliveries)
        .values({
          id,
          webhookId: deliveryWhId,
          systemId: deliverySystemId,
          eventType: "member.created",
          createdAt: now,
        })
        .run();

      db.delete(systems).where(eq(systems.id, deliverySystemId)).run();
      const rows = db.select().from(webhookDeliveries).where(eq(webhookDeliveries.id, id)).all();
      expect(rows).toHaveLength(0);
    });

    it("cascades on webhook config deletion", () => {
      const delId = crypto.randomUUID();
      const now = Date.now();

      db.insert(webhookDeliveries)
        .values({
          id: delId,
          webhookId: deliveryWhId,
          systemId: deliverySystemId,
          eventType: "member.created",
          createdAt: now,
        })
        .run();

      db.delete(webhookConfigs).where(eq(webhookConfigs.id, deliveryWhId)).run();
      const rows = db.select().from(webhookDeliveries).where(eq(webhookDeliveries.id, delId)).all();
      expect(rows).toHaveLength(0);
    });
  });
});
