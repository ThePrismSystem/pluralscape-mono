import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { apiKeys } from "../schema/pg/api-keys.js";
import { accounts } from "../schema/pg/auth.js";
import { systems } from "../schema/pg/systems.js";
import { webhookConfigs, webhookDeliveries } from "../schema/pg/webhooks.js";

import {
  MS_PER_DAY,
  TTL_RETENTION_DAYS,
  createPgWebhookTables,
  pgInsertAccount,
  pgInsertSystem,
  testBlob,
} from "./helpers/pg-helpers.js";

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

  afterEach(async () => {
    await db.delete(webhookDeliveries);
    await db.delete(webhookConfigs);
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
        encryptedData: testBlob(),
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

    it("defaults archived to false and archivedAt to null", async () => {
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
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(webhookConfigs).where(eq(webhookConfigs.id, id));
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("round-trips archived: true with archivedAt timestamp", async () => {
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
        archived: true,
        archivedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(webhookConfigs).where(eq(webhookConfigs.id, id));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("updates archived from false to true", async () => {
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
        createdAt: now,
        updatedAt: now,
      });

      const updateNow = Date.now();
      await db
        .update(webhookConfigs)
        .set({ archived: true, archivedAt: updateNow })
        .where(eq(webhookConfigs.id, id));
      const rows = await db.select().from(webhookConfigs).where(eq(webhookConfigs.id, id));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(updateNow);
    });

    it("rejects archived=true with archivedAt=null via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await expect(
        client.query(
          "INSERT INTO webhook_configs (id, system_id, url, secret, event_types, created_at, updated_at, archived, archived_at) VALUES ($1, $2, 'https://example.com/hook', '\\x01'::bytea, '[]', $3, $4, true, NULL)",
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
          "INSERT INTO webhook_configs (id, system_id, url, secret, event_types, created_at, updated_at, archived, archived_at) VALUES ($1, $2, 'https://example.com/hook', '\\x01'::bytea, '[]', $3, $4, false, $5)",
          [crypto.randomUUID(), systemId, now, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
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

    it("supports TTL cleanup query on terminal states", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const whId = crypto.randomUUID();
      const now = Date.now();
      const thirtyOneDaysAgo = now - (TTL_RETENTION_DAYS + 1) * MS_PER_DAY;

      await db.insert(webhookConfigs).values({
        id: whId,
        systemId,
        url: "https://example.com/hook",
        secret: new Uint8Array([1]),
        eventTypes: [],
        createdAt: now,
        updatedAt: now,
      });

      const oldId = crypto.randomUUID();
      const recentId = crypto.randomUUID();
      const pendingOldId = crypto.randomUUID();

      await db.insert(webhookDeliveries).values([
        {
          id: oldId,
          webhookId: whId,
          systemId,
          eventType: "member.created" as const,
          status: "success" as const,
          createdAt: thirtyOneDaysAgo,
        },
        {
          id: recentId,
          webhookId: whId,
          systemId,
          eventType: "member.created" as const,
          status: "failed" as const,
          createdAt: now,
        },
        {
          id: pendingOldId,
          webhookId: whId,
          systemId,
          eventType: "member.created" as const,
          status: "pending" as const,
          createdAt: thirtyOneDaysAgo,
        },
      ]);

      const cutoff = now - TTL_RETENTION_DAYS * MS_PER_DAY;
      await client.query(
        "DELETE FROM webhook_deliveries WHERE status IN ('success', 'failed') AND created_at < $1",
        [new Date(cutoff).toISOString()],
      );

      const remaining = await db
        .select()
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.webhookId, whId));
      expect(remaining).toHaveLength(2);
      expect(remaining.map((r) => r.id).sort()).toEqual([pendingOldId, recentId].sort());
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

    it("queries retryable deliveries by system_id", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const whId = crypto.randomUUID();
      const now = Date.now();
      const retryAt = now + 60_000;

      await db.insert(webhookConfigs).values({
        id: whId,
        systemId,
        url: "https://example.com/hook",
        secret: new Uint8Array([1]),
        eventTypes: [],
        createdAt: now,
        updatedAt: now,
      });

      const pendingId = crypto.randomUUID();
      const successId = crypto.randomUUID();
      const failedId = crypto.randomUUID();

      await db.insert(webhookDeliveries).values([
        {
          id: pendingId,
          webhookId: whId,
          systemId,
          eventType: "member.created" as const,
          status: "pending" as const,
          nextRetryAt: retryAt,
          createdAt: now,
        },
        {
          id: successId,
          webhookId: whId,
          systemId,
          eventType: "member.created" as const,
          status: "success" as const,
          createdAt: now,
        },
        {
          id: failedId,
          webhookId: whId,
          systemId,
          eventType: "member.created" as const,
          status: "failed" as const,
          createdAt: now,
        },
      ]);

      const retryable = await client.query<{ id: string }>(
        "SELECT id FROM webhook_deliveries WHERE system_id = $1 AND status NOT IN ('success', 'failed') ORDER BY next_retry_at",
        [systemId],
      );
      expect(retryable.rows).toHaveLength(1);
      expect(retryable.rows[0]?.id).toBe(pendingId);
    });

    it("defaults archived to false and archivedAt to null", async () => {
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

      const rows = await db.select().from(webhookDeliveries).where(eq(webhookDeliveries.id, id));
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("round-trips archived: true with archivedAt timestamp", async () => {
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
        archived: true,
        archivedAt: now,
        createdAt: now,
      });

      const rows = await db.select().from(webhookDeliveries).where(eq(webhookDeliveries.id, id));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("updates archived from false to true", async () => {
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

      const updateNow = Date.now();
      await db
        .update(webhookDeliveries)
        .set({ archived: true, archivedAt: updateNow })
        .where(eq(webhookDeliveries.id, id));
      const rows = await db.select().from(webhookDeliveries).where(eq(webhookDeliveries.id, id));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(updateNow);
    });

    it("rejects archived=true with archivedAt=null via CHECK constraint", async () => {
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
        client.query(
          "INSERT INTO webhook_deliveries (id, webhook_id, system_id, event_type, created_at, archived, archived_at) VALUES ($1, $2, $3, 'member.created', $4, true, NULL)",
          [crypto.randomUUID(), whId, systemId, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });

    it("rejects archived=false with archivedAt set via CHECK constraint", async () => {
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
        client.query(
          "INSERT INTO webhook_deliveries (id, webhook_id, system_id, event_type, created_at, archived, archived_at) VALUES ($1, $2, $3, 'member.created', $4, false, $5)",
          [crypto.randomUUID(), whId, systemId, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });
  });
});
