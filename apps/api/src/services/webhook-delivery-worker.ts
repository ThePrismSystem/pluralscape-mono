import { createHmac } from "node:crypto";

import { webhookConfigs, webhookDeliveries } from "@pluralscape/db/pg";
import { now } from "@pluralscape/types";
import { eq, sql } from "drizzle-orm";

import { WEBHOOK_BASE_BACKOFF_MS, WEBHOOK_MAX_RETRY_ATTEMPTS } from "../service.constants.js";

import type { WebhookDeliveryId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/** Name of the HMAC signature header sent with webhook deliveries. */
export const WEBHOOK_SIGNATURE_HEADER = "X-Pluralscape-Signature";

/** HMAC algorithm used for signing webhook payloads. */
const HMAC_ALGORITHM = "sha256";

/** HTTP status code threshold: 2xx is success. */
const HTTP_SUCCESS_MIN = 200;
const HTTP_SUCCESS_MAX = 299;

/** Default request timeout for webhook delivery (10 seconds). */
const DELIVERY_TIMEOUT_MS = 10_000;

/**
 * Compute HMAC-SHA256 signature for a webhook payload using the config's secret.
 */
export function computeWebhookSignature(secret: Buffer, payload: string): string {
  return createHmac(HMAC_ALGORITHM, secret).update(payload).digest("hex");
}

/**
 * Calculate exponential backoff delay for the given attempt number.
 * Uses 2^attempt * baseMs (e.g. 1s, 2s, 4s, 8s, 16s).
 */
export function calculateBackoffMs(attemptCount: number, baseMs: number): number {
  const TWO = 2;
  return Math.pow(TWO, attemptCount) * baseMs;
}

/**
 * Process a single pending webhook delivery.
 *
 * 1. Fetches the webhook config to get the URL and signing secret.
 * 2. Sends an HTTP POST with the JSON payload and HMAC signature header.
 * 3. On success (2xx): marks the delivery as 'success'.
 * 4. On failure: increments attempt count and schedules retry with exponential backoff.
 * 5. After max attempts: marks the delivery as 'failed'.
 */
export async function processWebhookDelivery(
  db: PostgresJsDatabase,
  deliveryId: WebhookDeliveryId,
  payload: Readonly<Record<string, unknown>>,
  fetchFn: typeof fetch = fetch,
): Promise<void> {
  // Load delivery and associated config
  const [delivery] = await db
    .select({
      id: webhookDeliveries.id,
      webhookId: webhookDeliveries.webhookId,
      systemId: webhookDeliveries.systemId,
      eventType: webhookDeliveries.eventType,
      attemptCount: webhookDeliveries.attemptCount,
    })
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.id, deliveryId))
    .limit(1);

  if (!delivery) return;

  const [config] = await db
    .select({
      id: webhookConfigs.id,
      url: webhookConfigs.url,
      secret: webhookConfigs.secret,
      enabled: webhookConfigs.enabled,
    })
    .from(webhookConfigs)
    .where(eq(webhookConfigs.id, delivery.webhookId))
    .limit(1);

  // If config is missing or disabled, mark delivery as failed
  if (!config?.enabled) {
    await db
      .update(webhookDeliveries)
      .set({
        status: "failed",
        lastAttemptAt: now(),
      })
      .where(eq(webhookDeliveries.id, deliveryId));
    return;
  }

  const payloadJson = JSON.stringify(payload);
  const signature = computeWebhookSignature(Buffer.from(config.secret), payloadJson);
  const timestamp = now();

  let httpStatus: number | null = null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, DELIVERY_TIMEOUT_MS);

    try {
      const response = await fetchFn(config.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [WEBHOOK_SIGNATURE_HEADER]: signature,
        },
        body: payloadJson,
        signal: controller.signal,
      });
      httpStatus = response.status;
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    // Network error — httpStatus stays null
  }

  const isSuccess =
    httpStatus !== null && httpStatus >= HTTP_SUCCESS_MIN && httpStatus <= HTTP_SUCCESS_MAX;

  if (isSuccess) {
    await db
      .update(webhookDeliveries)
      .set({
        status: "success",
        httpStatus,
        lastAttemptAt: timestamp,
        attemptCount: sql`${webhookDeliveries.attemptCount} + 1`,
      })
      .where(eq(webhookDeliveries.id, deliveryId));
    return;
  }

  // Failure path
  const newAttemptCount = delivery.attemptCount + 1;

  if (newAttemptCount >= WEBHOOK_MAX_RETRY_ATTEMPTS) {
    await db
      .update(webhookDeliveries)
      .set({
        status: "failed",
        httpStatus,
        lastAttemptAt: timestamp,
        attemptCount: newAttemptCount,
      })
      .where(eq(webhookDeliveries.id, deliveryId));
    return;
  }

  const backoffMs = calculateBackoffMs(newAttemptCount, WEBHOOK_BASE_BACKOFF_MS);
  const nextRetryAt = timestamp + backoffMs;

  await db
    .update(webhookDeliveries)
    .set({
      httpStatus,
      lastAttemptAt: timestamp,
      attemptCount: newAttemptCount,
      nextRetryAt,
    })
    .where(eq(webhookDeliveries.id, deliveryId));
}
