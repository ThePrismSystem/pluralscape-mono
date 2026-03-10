import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

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
    it("round-trips with defaults", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const whId = crypto.randomUUID();
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(webhookConfigs)
        .values({
          id: whId,
          systemId,
          url: "https://example.com/hook",
          secret: new Uint8Array([1]),
          eventTypes: ["member.created"],
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.insert(webhookDeliveries)
        .values({
          id,
          webhookId: whId,
          systemId,
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

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const whId = crypto.randomUUID();
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(webhookConfigs)
        .values({
          id: whId,
          systemId,
          url: "https://example.com/hook",
          secret: new Uint8Array([1]),
          eventTypes: [],
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.insert(webhookDeliveries)
        .values({
          id,
          webhookId: whId,
          systemId,
          eventType: "member.created",
          createdAt: now,
        })
        .run();

      db.delete(systems).where(eq(systems.id, systemId)).run();
      const rows = db.select().from(webhookDeliveries).where(eq(webhookDeliveries.id, id)).all();
      expect(rows).toHaveLength(0);
    });

    it("cascades on webhook config deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const whId = crypto.randomUUID();
      const delId = crypto.randomUUID();
      const now = Date.now();

      db.insert(webhookConfigs)
        .values({
          id: whId,
          systemId,
          url: "https://example.com/hook",
          secret: new Uint8Array([1]),
          eventTypes: [],
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.insert(webhookDeliveries)
        .values({
          id: delId,
          webhookId: whId,
          systemId,
          eventType: "member.created",
          createdAt: now,
        })
        .run();

      db.delete(webhookConfigs).where(eq(webhookConfigs.id, whId)).run();
      const rows = db.select().from(webhookDeliveries).where(eq(webhookDeliveries.id, delId)).all();
      expect(rows).toHaveLength(0);
    });
  });
});
