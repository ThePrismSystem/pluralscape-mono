import Database from "better-sqlite3-multiple-ciphers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { apiKeys } from "../schema/sqlite/api-keys.js";
import { accounts } from "../schema/sqlite/auth.js";
import { systems } from "../schema/sqlite/systems.js";
import { webhookConfigs, webhookDeliveries } from "../schema/sqlite/webhooks.js";

import {
  MS_PER_DAY,
  TTL_RETENTION_DAYS,
  createSqliteWebhookTables,
  sqliteInsertAccount,
  sqliteInsertSystem,
  testBlob,
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

    it("restricts api_key deletion when referenced by webhook config", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const keyId = crypto.randomUUID();
      const now = Date.now();

      db.insert(apiKeys)
        .values({
          id: keyId,
          accountId,
          systemId,
          encryptedData: testBlob(),
          keyType: "metadata",
          tokenHash: `hash-${crypto.randomUUID()}`,
          scopes: ["read:members"],
          createdAt: now,
        })
        .run();

      db.insert(webhookConfigs)
        .values({
          id: crypto.randomUUID(),
          systemId,
          url: "https://example.com/hook",
          secret: new Uint8Array([1]),
          eventTypes: [],
          cryptoKeyId: keyId,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      expect(() => db.delete(apiKeys).where(eq(apiKeys.id, keyId)).run()).toThrow(
        /FOREIGN KEY|constraint/i,
      );
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

    it("defaults archived to false and archivedAt to null", () => {
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
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(webhookConfigs).where(eq(webhookConfigs.id, id)).all();
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("round-trips archived: true with archivedAt timestamp", () => {
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
          archived: true,
          archivedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(webhookConfigs).where(eq(webhookConfigs.id, id)).all();
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
            "INSERT INTO webhook_configs (id, system_id, url, secret, event_types, created_at, updated_at, archived, archived_at) VALUES (?, ?, 'https://example.com/hook', X'01', '[]', ?, ?, 1, NULL)",
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
            "INSERT INTO webhook_configs (id, system_id, url, secret, event_types, created_at, updated_at, archived, archived_at) VALUES (?, ?, 'https://example.com/hook', X'01', '[]', ?, ?, 0, ?)",
          )
          .run(crypto.randomUUID(), systemId, now, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("updates archived from false to true", () => {
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
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.update(webhookConfigs)
        .set({ archived: true, archivedAt: now, updatedAt: now })
        .where(eq(webhookConfigs.id, id))
        .run();

      const rows = db.select().from(webhookConfigs).where(eq(webhookConfigs.id, id)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
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
          payloadData: { test: true },
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
            `INSERT INTO webhook_deliveries (id, webhook_id, system_id, event_type, created_at, payload_data)
             VALUES (?, ?, ?, ?, ?, '{"test":true}')`,
          )
          .run(crypto.randomUUID(), deliveryWhId, deliverySystemId, "invalid-event", now),
      ).toThrow();
    });

    it("rejects invalid status", () => {
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            `INSERT INTO webhook_deliveries (id, webhook_id, system_id, event_type, status, created_at, payload_data)
             VALUES (?, ?, ?, ?, ?, ?, '{"test":true}')`,
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
            `INSERT INTO webhook_deliveries (id, webhook_id, system_id, event_type, attempt_count, created_at, payload_data)
             VALUES (?, ?, ?, ?, ?, ?, '{"test":true}')`,
          )
          .run(crypto.randomUUID(), deliveryWhId, deliverySystemId, "member.created", -1, now),
      ).toThrow();
    });

    it("rejects http_status outside 100-599", () => {
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            `INSERT INTO webhook_deliveries (id, webhook_id, system_id, event_type, http_status, created_at, payload_data)
             VALUES (?, ?, ?, ?, ?, ?, '{"test":true}')`,
          )
          .run(crypto.randomUUID(), deliveryWhId, deliverySystemId, "member.created", 99, now),
      ).toThrow();

      expect(() =>
        client
          .prepare(
            `INSERT INTO webhook_deliveries (id, webhook_id, system_id, event_type, http_status, created_at, payload_data)
             VALUES (?, ?, ?, ?, ?, ?, '{"test":true}')`,
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
          payloadData: { test: true },
          createdAt: now,
        })
        .run();

      db.delete(systems).where(eq(systems.id, deliverySystemId)).run();
      const rows = db.select().from(webhookDeliveries).where(eq(webhookDeliveries.id, id)).all();
      expect(rows).toHaveLength(0);
    });

    it("supports TTL cleanup query on terminal states", () => {
      const now = Date.now();
      const thirtyOneDaysAgo = now - (TTL_RETENTION_DAYS + 1) * MS_PER_DAY;
      const whId = crypto.randomUUID();

      db.insert(webhookConfigs)
        .values({
          id: whId,
          systemId: deliverySystemId,
          url: "https://example.com/hook",
          secret: new Uint8Array([1]),
          eventTypes: [],
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const oldId = crypto.randomUUID();
      const recentId = crypto.randomUUID();
      const pendingOldId = crypto.randomUUID();

      db.insert(webhookDeliveries)
        .values([
          {
            id: oldId,
            webhookId: whId,
            systemId: deliverySystemId,
            eventType: "member.created" as const,
            status: "success" as const,
            payloadData: { test: true },
            createdAt: thirtyOneDaysAgo,
          },
          {
            id: recentId,
            webhookId: whId,
            systemId: deliverySystemId,
            eventType: "member.created" as const,
            status: "failed" as const,
            payloadData: { test: true },
            createdAt: now,
          },
          {
            id: pendingOldId,
            webhookId: whId,
            systemId: deliverySystemId,
            eventType: "member.created" as const,
            status: "pending" as const,
            payloadData: { test: true },
            createdAt: thirtyOneDaysAgo,
          },
        ])
        .run();

      const cutoff = now - TTL_RETENTION_DAYS * MS_PER_DAY;
      client
        .prepare(
          "DELETE FROM webhook_deliveries WHERE status IN ('success', 'failed') AND created_at < ?",
        )
        .run(cutoff);

      const remaining = db
        .select()
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.webhookId, whId))
        .all();
      expect(remaining).toHaveLength(2);
      expect(remaining.map((r) => r.id).sort()).toEqual([pendingOldId, recentId].sort());
    });

    it("restricts webhook config deletion when referenced by delivery", () => {
      const now = Date.now();

      db.insert(webhookDeliveries)
        .values({
          id: crypto.randomUUID(),
          webhookId: deliveryWhId,
          systemId: deliverySystemId,
          eventType: "member.created",
          payloadData: { test: true },
          createdAt: now,
        })
        .run();

      expect(() =>
        db.delete(webhookConfigs).where(eq(webhookConfigs.id, deliveryWhId)).run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("queries retryable deliveries by system_id", () => {
      const now = Date.now();
      const retryAt = now + 60_000;

      const pendingId = crypto.randomUUID();
      const successId = crypto.randomUUID();
      const failedId = crypto.randomUUID();

      db.insert(webhookDeliveries)
        .values([
          {
            id: pendingId,
            webhookId: deliveryWhId,
            systemId: deliverySystemId,
            eventType: "member.created" as const,
            status: "pending" as const,
            nextRetryAt: retryAt,
            payloadData: { test: true },
            createdAt: now,
          },
          {
            id: successId,
            webhookId: deliveryWhId,
            systemId: deliverySystemId,
            eventType: "member.created" as const,
            status: "success" as const,
            payloadData: { test: true },
            createdAt: now,
          },
          {
            id: failedId,
            webhookId: deliveryWhId,
            systemId: deliverySystemId,
            eventType: "member.created" as const,
            status: "failed" as const,
            payloadData: { test: true },
            createdAt: now,
          },
        ])
        .run();

      const retryable = client
        .prepare(
          "SELECT id FROM webhook_deliveries WHERE system_id = ? AND status NOT IN ('success', 'failed') ORDER BY next_retry_at",
        )
        .all(deliverySystemId) as Array<{ id: string }>;
      expect(retryable).toHaveLength(1);
      expect(retryable[0]?.id).toBe(pendingId);
    });

    it("rejects delivery with neither encrypted_data nor payload_data via CHECK constraint", () => {
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            "INSERT INTO webhook_deliveries (id, webhook_id, system_id, event_type, created_at, encrypted_data, payload_data) VALUES (?, ?, ?, 'member.created', ?, NULL, NULL)",
          )
          .run(crypto.randomUUID(), deliveryWhId, deliverySystemId, now),
      ).toThrow(/CHECK|constraint/i);
    });
  });
});
