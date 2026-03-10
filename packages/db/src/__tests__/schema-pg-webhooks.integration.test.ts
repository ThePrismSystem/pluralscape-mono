import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { apiKeys } from "../schema/pg/api-keys.js";
import { accounts } from "../schema/pg/auth.js";
import { systems } from "../schema/pg/systems.js";
import { webhookConfigs, webhookDeliveries } from "../schema/pg/webhooks.js";

import { createPgWebhookTables, pgInsertAccount, pgInsertSystem } from "./helpers/pg-helpers.js";

import type { PgliteDatabase } from "drizzle-orm/pglite";

const schema = { accounts, systems, apiKeys, webhookConfigs, webhookDeliveries };

describe("PG webhooks schema", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;

  const insertAccount = (id?: string) => pgInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string) => pgInsertSystem(db, accountId, id);

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgWebhookTables(client);
  });

  afterAll(async () => {
    await client.close();
  });

  describe("webhook_configs", () => {
    it("round-trips all fields", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const secret = new Uint8Array([1, 2, 3]);

      await db.insert(webhookConfigs).values({
        id,
        systemId,
        url: "https://example.com/webhook",
        secret,
        eventTypes: ["member.created", "fronting.started"],
        enabled: true,
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(webhookConfigs).where(eq(webhookConfigs.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.url).toBe("https://example.com/webhook");
      expect(rows[0]?.secret).toEqual(secret);
      expect(rows[0]?.eventTypes).toEqual(["member.created", "fronting.started"]);
      expect(rows[0]?.enabled).toBe(true);
      expect(rows[0]?.cryptoKeyId).toBeNull();
    });

    it("defaults enabled to true", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(webhookConfigs).values({
        id,
        systemId,
        url: "https://example.com/hook",
        secret: new Uint8Array([4, 5]),
        eventTypes: [],
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(webhookConfigs).where(eq(webhookConfigs.id, id));
      expect(rows[0]?.enabled).toBe(true);
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(webhookConfigs).values({
        id,
        systemId,
        url: "https://example.com/del",
        secret: new Uint8Array([1]),
        eventTypes: [],
        createdAt: now,
        updatedAt: now,
      });

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db.select().from(webhookConfigs).where(eq(webhookConfigs.id, id));
      expect(rows).toHaveLength(0);
    });

    it("sets crypto_key_id to NULL on api_key deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const keyId = crypto.randomUUID();
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(apiKeys).values({
        id: keyId,
        accountId,
        systemId,
        name: "test-key",
        keyType: "metadata",
        tokenHash: `hash-${crypto.randomUUID()}`,
        scopes: ["read:members"],
        createdAt: now,
      });

      await db.insert(webhookConfigs).values({
        id,
        systemId,
        url: "https://example.com/hook",
        secret: new Uint8Array([1]),
        eventTypes: [],
        cryptoKeyId: keyId,
        createdAt: now,
        updatedAt: now,
      });

      await db.delete(apiKeys).where(eq(apiKeys.id, keyId));
      const rows = await db.select().from(webhookConfigs).where(eq(webhookConfigs.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.cryptoKeyId).toBeNull();
    });

    it("stores enabled as false correctly", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(webhookConfigs).values({
        id,
        systemId,
        url: "https://example.com/hook",
        secret: new Uint8Array([1]),
        eventTypes: [],
        enabled: false,
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(webhookConfigs).where(eq(webhookConfigs.id, id));
      expect(rows[0]?.enabled).toBe(false);
    });
  });

  describe("webhook_deliveries", () => {
    it("round-trips with defaults", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const whId = crypto.randomUUID();
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(webhookConfigs).values({
        id: whId,
        systemId,
        url: "https://example.com/hook",
        secret: new Uint8Array([1]),
        eventTypes: ["member.created"],
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(webhookDeliveries).values({
        id,
        webhookId: whId,
        systemId,
        eventType: "member.created",
        createdAt: now,
      });

      const rows = await db.select().from(webhookDeliveries).where(eq(webhookDeliveries.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.status).toBe("pending");
      expect(rows[0]?.attemptCount).toBe(0);
      expect(rows[0]?.httpStatus).toBeNull();
      expect(rows[0]?.encryptedData).toBeNull();
    });

    it("rejects invalid event type", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const whId = crypto.randomUUID();
      const now = Date.now();

      await db.insert(webhookConfigs).values({
        id: whId,
        systemId,
        url: "https://example.com/hook",
        secret: new Uint8Array([1]),
        eventTypes: [],
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        db.insert(webhookDeliveries).values({
          id: crypto.randomUUID(),
          webhookId: whId,
          systemId,
          eventType: "invalid.event" as "member.created",
          createdAt: now,
        }),
      ).rejects.toThrow();
    });

    it("rejects negative attempt count", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const whId = crypto.randomUUID();
      const now = Date.now();

      await db.insert(webhookConfigs).values({
        id: whId,
        systemId,
        url: "https://example.com/hook",
        secret: new Uint8Array([1]),
        eventTypes: [],
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        db.insert(webhookDeliveries).values({
          id: crypto.randomUUID(),
          webhookId: whId,
          systemId,
          eventType: "member.created",
          attemptCount: -1,
          createdAt: now,
        }),
      ).rejects.toThrow();
    });

    it("rejects invalid HTTP status", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const whId = crypto.randomUUID();
      const now = Date.now();

      await db.insert(webhookConfigs).values({
        id: whId,
        systemId,
        url: "https://example.com/hook",
        secret: new Uint8Array([1]),
        eventTypes: [],
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        db.insert(webhookDeliveries).values({
          id: crypto.randomUUID(),
          webhookId: whId,
          systemId,
          eventType: "member.created",
          httpStatus: 999,
          createdAt: now,
        }),
      ).rejects.toThrow();
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const whId = crypto.randomUUID();
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(webhookConfigs).values({
        id: whId,
        systemId,
        url: "https://example.com/hook",
        secret: new Uint8Array([1]),
        eventTypes: [],
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(webhookDeliveries).values({
        id,
        webhookId: whId,
        systemId,
        eventType: "member.created",
        createdAt: now,
      });

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db.select().from(webhookDeliveries).where(eq(webhookDeliveries.id, id));
      expect(rows).toHaveLength(0);
    });

    it("rejects invalid status", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const whId = crypto.randomUUID();
      const now = Date.now();

      await db.insert(webhookConfigs).values({
        id: whId,
        systemId,
        url: "https://example.com/hook",
        secret: new Uint8Array([1]),
        eventTypes: [],
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        db.insert(webhookDeliveries).values({
          id: crypto.randomUUID(),
          webhookId: whId,
          systemId,
          eventType: "member.created",
          status: "queued" as "pending",
          createdAt: now,
        }),
      ).rejects.toThrow();
    });

    it("cascades on webhook config deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const whId = crypto.randomUUID();
      const delId = crypto.randomUUID();
      const now = Date.now();

      await db.insert(webhookConfigs).values({
        id: whId,
        systemId,
        url: "https://example.com/hook",
        secret: new Uint8Array([1]),
        eventTypes: [],
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(webhookDeliveries).values({
        id: delId,
        webhookId: whId,
        systemId,
        eventType: "member.created",
        createdAt: now,
      });

      await db.delete(webhookConfigs).where(eq(webhookConfigs.id, whId));
      const rows = await db.select().from(webhookDeliveries).where(eq(webhookDeliveries.id, delId));
      expect(rows).toHaveLength(0);
    });
  });
});
