import { createHmac, randomBytes } from "node:crypto";

import { PGlite } from "@electric-sql/pglite";
import { accounts, apiKeys, systems, webhookConfigs, webhookDeliveries } from "@pluralscape/db/pg";
import {
  createPgWebhookTables,
  pgInsertAccount,
  pgInsertSystem,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { WEBHOOK_MAX_RETRY_ATTEMPTS } from "../../service.constants.js";
import {
  computeWebhookSignature,
  findPendingDeliveries,
  processWebhookDelivery,
  WEBHOOK_SIGNATURE_HEADER,
} from "../../services/webhook-delivery-worker.js";

import type { WebhookDeliveryId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const schema = { accounts, systems, apiKeys, webhookConfigs, webhookDeliveries };

describe("webhook-delivery-worker (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let systemId: string;
  let webhookId: string;
  let webhookSecret: Buffer;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgWebhookTables(client);
    const accountId = await pgInsertAccount(db);
    systemId = await pgInsertSystem(db, accountId);

    // Insert a webhook config with a known secret
    webhookSecret = randomBytes(32);
    webhookId = `wh_${crypto.randomUUID()}`;
    await db.insert(webhookConfigs).values({
      id: webhookId,
      systemId,
      url: "https://example.com/hook",
      secret: webhookSecret,
      eventTypes: ["fronting.started"],
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(webhookDeliveries);
    vi.restoreAllMocks();
  });

  async function insertDelivery(overrides: Record<string, unknown> = {}): Promise<string> {
    const id = `wd_${crypto.randomUUID()}`;
    await db.insert(webhookDeliveries).values({
      id,
      webhookId,
      systemId,
      eventType: "fronting.started",
      status: "pending",
      attemptCount: 0,
      payloadData: { test: true },
      createdAt: Date.now(),
      ...overrides,
    });
    return id;
  }

  describe("computeWebhookSignature", () => {
    it("produces HMAC-SHA256 hex digest", () => {
      const secret = Buffer.from("test-secret");
      const payload = '{"test":true}';
      const sig = computeWebhookSignature(secret, payload);

      const expected = createHmac("sha256", secret).update(payload).digest("hex");
      expect(sig).toBe(expected);
    });
  });

  describe("processWebhookDelivery", () => {
    it("success path: marks as success on 2xx", async () => {
      const deliveryId = await insertDelivery();
      const payload = { test: true };

      const mockFetch = vi.fn().mockResolvedValue(new Response("OK", { status: 200 }));

      await processWebhookDelivery(
        db as never,
        deliveryId as WebhookDeliveryId,
        payload,
        mockFetch as never,
      );

      // Verify the fetch was called with correct signature
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("https://example.com/hook");
      const headers = init.headers as Record<string, string>;
      expect(headers[WEBHOOK_SIGNATURE_HEADER]).toBeTruthy();

      // Verify delivery status in DB
      const [row] = await db
        .select()
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.id, deliveryId));
      expect(row?.status).toBe("success");
      expect(row?.httpStatus).toBe(200);
    });

    it("failure path: increments attempt and sets nextRetryAt", async () => {
      const deliveryId = await insertDelivery();
      const mockFetch = vi.fn().mockResolvedValue(new Response("Error", { status: 500 }));

      await processWebhookDelivery(
        db as never,
        deliveryId as WebhookDeliveryId,
        { test: true },
        mockFetch as never,
      );

      const [row] = await db
        .select()
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.id, deliveryId));
      expect(row?.status).toBe("pending");
      expect(row?.httpStatus).toBe(500);
      expect(row?.attemptCount).toBe(1);
      expect(row?.nextRetryAt).toEqual(expect.any(Number));
    });

    it("max retries exceeded: marks as failed", async () => {
      const deliveryId = await insertDelivery({
        attemptCount: WEBHOOK_MAX_RETRY_ATTEMPTS - 1,
      });
      const mockFetch = vi.fn().mockResolvedValue(new Response("Error", { status: 500 }));

      await processWebhookDelivery(
        db as never,
        deliveryId as WebhookDeliveryId,
        { test: true },
        mockFetch as never,
      );

      const [row] = await db
        .select()
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.id, deliveryId));
      expect(row?.status).toBe("failed");
    });

    it("marks as failed when config is disabled", async () => {
      // Create a disabled config
      const disabledWhId = `wh_${crypto.randomUUID()}`;
      await db.insert(webhookConfigs).values({
        id: disabledWhId,
        systemId,
        url: "https://example.com/disabled",
        secret: randomBytes(32),
        eventTypes: ["fronting.started"],
        enabled: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const deliveryId = await insertDelivery({ webhookId: disabledWhId });
      const mockFetch = vi.fn();

      await processWebhookDelivery(
        db as never,
        deliveryId as WebhookDeliveryId,
        { test: true },
        mockFetch as never,
      );

      expect(mockFetch).not.toHaveBeenCalled();
      const [row] = await db
        .select()
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.id, deliveryId));
      expect(row?.status).toBe("failed");
    });

    it("handles network timeout (null httpStatus)", async () => {
      const deliveryId = await insertDelivery();
      const mockFetch = vi.fn().mockRejectedValue(new TypeError("fetch failed"));

      await processWebhookDelivery(
        db as never,
        deliveryId as WebhookDeliveryId,
        { test: true },
        mockFetch as never,
      );

      const [row] = await db
        .select()
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.id, deliveryId));
      expect(row?.httpStatus).toBeNull();
      expect(row?.attemptCount).toBe(1);
    });
  });

  describe("findPendingDeliveries", () => {
    it("finds deliveries with status=pending and no nextRetryAt", async () => {
      await insertDelivery();
      const results = await findPendingDeliveries(db as never, 10);
      expect(results.length).toBe(1);
    });

    it("excludes deliveries with future nextRetryAt", async () => {
      await insertDelivery({ nextRetryAt: Date.now() + 60000 });
      const results = await findPendingDeliveries(db as never, 10);
      expect(results.length).toBe(0);
    });

    it("includes deliveries with past nextRetryAt", async () => {
      await insertDelivery({ nextRetryAt: Date.now() - 1000 });
      const results = await findPendingDeliveries(db as never, 10);
      expect(results.length).toBe(1);
    });
  });
});
