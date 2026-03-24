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

import {
  WEBHOOK_MAX_RETRY_ATTEMPTS,
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_TIMESTAMP_HEADER,
} from "../../service.constants.js";
import {
  calculateBackoffMs,
  computeWebhookSignature,
  findPendingDeliveries,
  processWebhookDelivery,
} from "../../services/webhook-delivery-worker.js";
import { genWebhookDeliveryId, genWebhookId } from "../helpers/integration-setup.js";

import type { AccountId, SystemId, WebhookDeliveryId, WebhookId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const schema = { accounts, systems, apiKeys, webhookConfigs, webhookDeliveries };

describe("webhook-delivery-worker (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let systemId: SystemId;
  let webhookId: WebhookId;
  let webhookSecret: Buffer;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgWebhookTables(client);
    const accountId = (await pgInsertAccount(db)) as AccountId;
    systemId = (await pgInsertSystem(db, accountId)) as SystemId;

    // Insert a webhook config with a known secret
    webhookSecret = randomBytes(32);
    webhookId = genWebhookId();
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

  async function insertDelivery(
    overrides: Record<string, unknown> = {},
  ): Promise<WebhookDeliveryId> {
    const id = genWebhookDeliveryId();
    const values = {
      id,
      webhookId,
      systemId,
      eventType: "fronting.started" as const,
      status: "pending" as const,
      attemptCount: 0,
      payloadData: { test: true },
      createdAt: Date.now(),
      ...overrides,
    };
    await db.insert(webhookDeliveries).values(values as typeof webhookDeliveries.$inferInsert);
    return id;
  }

  describe("computeWebhookSignature", () => {
    it("produces HMAC-SHA256 hex digest with timestamp prefix", () => {
      const secret = Buffer.from("test-secret");
      const timestamp = 1700000000;
      const payload = '{"test":true}';
      const sig = computeWebhookSignature(secret, timestamp, payload);

      const expected = createHmac("sha256", secret)
        .update(`${String(timestamp)}.${payload}`)
        .digest("hex");
      expect(sig).toBe(expected);
    });
  });

  describe("processWebhookDelivery", () => {
    it("success path: marks as success on 2xx", async () => {
      const deliveryId = await insertDelivery();
      const payload = { test: true };

      const mockFetch = vi.fn().mockResolvedValue(new Response("OK", { status: 200 }));

      await processWebhookDelivery(db as never, deliveryId, payload, mockFetch as never);

      // Verify the fetch was called with correct signature and timestamp
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const call = mockFetch.mock.calls[0] ?? [];
      expect(call[0]).toBe("https://example.com/hook");
      const headers = new Headers((call[1] as RequestInit | undefined)?.headers);

      // Verify timestamp header is present and is a valid Unix timestamp
      const timestampHeader = headers.get(WEBHOOK_TIMESTAMP_HEADER);
      expect(timestampHeader).toBeTruthy();
      const timestamp = Number(timestampHeader);
      expect(Number.isInteger(timestamp)).toBe(true);
      expect(timestamp).toBeGreaterThan(0);

      // Verify signature matches using the sent timestamp
      const expectedSig = computeWebhookSignature(
        webhookSecret,
        timestamp,
        JSON.stringify(payload),
      );
      expect(headers.get(WEBHOOK_SIGNATURE_HEADER)).toBe(expectedSig);

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

      await processWebhookDelivery(db as never, deliveryId, { test: true }, mockFetch as never);

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

      await processWebhookDelivery(db as never, deliveryId, { test: true }, mockFetch as never);

      const [row] = await db
        .select()
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.id, deliveryId));
      expect(row?.status).toBe("failed");
    });

    it("marks as failed when config is disabled", async () => {
      // Create a disabled config
      const disabledWhId = genWebhookId();
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

      await processWebhookDelivery(db as never, deliveryId, { test: true }, mockFetch as never);

      expect(mockFetch).not.toHaveBeenCalled();
      const [row] = await db
        .select()
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.id, deliveryId));
      expect(row?.status).toBe("failed");

      // Clean up the disabled config
      await db.delete(webhookDeliveries).where(eq(webhookDeliveries.webhookId, disabledWhId));
      await db.delete(webhookConfigs).where(eq(webhookConfigs.id, disabledWhId));
    });

    it("handles network timeout (null httpStatus)", async () => {
      const deliveryId = await insertDelivery();
      const mockFetch = vi.fn().mockRejectedValue(new TypeError("fetch failed"));

      await processWebhookDelivery(db as never, deliveryId, { test: true }, mockFetch as never);

      const [row] = await db
        .select()
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.id, deliveryId));
      expect(row?.httpStatus).toBeNull();
      expect(row?.attemptCount).toBe(1);
      expect(row?.status).toBe("pending");
    });

    it("sends timestamp header in delivery requests", async () => {
      const deliveryId = await insertDelivery();
      const mockFetch = vi.fn().mockResolvedValue(new Response("OK", { status: 200 }));

      await processWebhookDelivery(db as never, deliveryId, { test: true }, mockFetch as never);

      const call = mockFetch.mock.calls[0] ?? [];
      const headers = new Headers((call[1] as RequestInit | undefined)?.headers);

      expect(headers.get(WEBHOOK_TIMESTAMP_HEADER)).toBeTruthy();
      expect(headers.get(WEBHOOK_SIGNATURE_HEADER)).toBeTruthy();
    });
  });

  describe("findPendingDeliveries", () => {
    it("finds deliveries with status=pending and no nextRetryAt", async () => {
      const deliveryId = await insertDelivery();
      const results = await findPendingDeliveries(db as never, 10);
      expect(results.length).toBe(1);
      expect(results[0]?.id).toBe(deliveryId);
    });

    it("excludes deliveries with future nextRetryAt", async () => {
      await insertDelivery({ nextRetryAt: Date.now() + 60000 });
      const results = await findPendingDeliveries(db as never, 10);
      expect(results.length).toBe(0);
    });

    it("includes deliveries with past nextRetryAt", async () => {
      const deliveryId = await insertDelivery({ nextRetryAt: Date.now() - 1000 });
      const results = await findPendingDeliveries(db as never, 10);
      expect(results.length).toBe(1);
      expect(results[0]?.id).toBe(deliveryId);
    });
  });

  describe("calculateBackoffMs", () => {
    it("increases exponentially with attempt count", () => {
      const base = 1000;
      const b1 = calculateBackoffMs(1, base, 0);
      const b2 = calculateBackoffMs(2, base, 0);
      const b3 = calculateBackoffMs(3, base, 0);
      expect(b1).toBe(2000); // 2^1 * 1000
      expect(b2).toBe(4000); // 2^2 * 1000
      expect(b3).toBe(8000); // 2^3 * 1000
    });

    it("returns non-negative with jitter", () => {
      for (let i = 0; i < 20; i++) {
        expect(calculateBackoffMs(1, 1000)).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
