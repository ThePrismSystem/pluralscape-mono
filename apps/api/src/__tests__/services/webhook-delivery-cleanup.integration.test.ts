import { PGlite } from "@electric-sql/pglite";
import * as schema from "@pluralscape/db/pg";
import {
  createPgWebhookTables,
  pgInsertAccount,
  pgInsertSystem,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { WEBHOOK_DELIVERY_RETENTION_DAYS } from "../../service.constants.js";
import { cleanupWebhookDeliveries } from "../../services/webhook-delivery-cleanup.js";
import { asDb, genWebhookDeliveryId, genWebhookId } from "../helpers/integration-setup.js";

import type { AccountId, SystemId, WebhookDeliveryId, WebhookId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const MS_PER_DAY = 86_400_000;
const { webhookConfigs, webhookDeliveries } = schema;

describe("webhook-delivery-cleanup (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let systemId: SystemId;
  let webhookId: WebhookId;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgWebhookTables(client);
    const accountId = (await pgInsertAccount(db)) as AccountId;
    systemId = (await pgInsertSystem(db, accountId)) as SystemId;

    webhookId = genWebhookId();
    await db.insert(webhookConfigs).values({
      id: webhookId,
      systemId,
      url: "https://example.com/hook",
      secret: Buffer.from("test-secret"),
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
  });

  async function insertDelivery(
    status: "pending" | "success" | "failed",
    ageInDays: number,
  ): Promise<WebhookDeliveryId> {
    const id = genWebhookDeliveryId();
    const createdAt = Date.now() - ageInDays * MS_PER_DAY;
    await db.insert(webhookDeliveries).values({
      id,
      webhookId,
      systemId,
      eventType: "fronting.started",
      status,
      attemptCount: status === "pending" ? 0 : 1,
      payloadData: {},
      createdAt,
    });
    return id;
  }

  it("deletes terminal deliveries older than retention period", async () => {
    await insertDelivery("success", WEBHOOK_DELIVERY_RETENTION_DAYS + 1);
    await insertDelivery("failed", WEBHOOK_DELIVERY_RETENTION_DAYS + 5);

    const count = await cleanupWebhookDeliveries(asDb(db));
    expect(count).toBe(2);

    const remaining = await db.select().from(webhookDeliveries);
    expect(remaining.length).toBe(0);
  });

  it("preserves pending deliveries regardless of age", async () => {
    await insertDelivery("pending", WEBHOOK_DELIVERY_RETENTION_DAYS + 10);

    const count = await cleanupWebhookDeliveries(asDb(db));
    expect(count).toBe(0);

    const remaining = await db.select().from(webhookDeliveries);
    expect(remaining.length).toBe(1);
  });

  it("preserves recent terminal deliveries", async () => {
    await insertDelivery("success", 1);
    await insertDelivery("failed", 5);

    const count = await cleanupWebhookDeliveries(asDb(db));
    expect(count).toBe(0);

    const remaining = await db.select().from(webhookDeliveries);
    expect(remaining.length).toBe(2);
  });

  it("respects custom retention days", async () => {
    await insertDelivery("success", 10);

    const countDefault = await cleanupWebhookDeliveries(asDb(db));
    expect(countDefault).toBe(0);

    const countCustom = await cleanupWebhookDeliveries(asDb(db), 5);
    expect(countCustom).toBe(1);
  });

  it("deletes in batches and returns total count", async () => {
    const testBatchSize = 10;
    const totalRecords = testBatchSize + 5;
    for (let i = 0; i < totalRecords; i++) {
      await insertDelivery("success", WEBHOOK_DELIVERY_RETENTION_DAYS + 1);
    }

    const count = await cleanupWebhookDeliveries(
      asDb(db),
      WEBHOOK_DELIVERY_RETENTION_DAYS,
      testBatchSize,
    );
    expect(count).toBe(totalRecords);

    const remaining = await db.select().from(webhookDeliveries);
    expect(remaining.length).toBe(0);
  });
});
