import { createHmac } from "node:crypto";

import { webhookConfigs, webhookDeliveries } from "@pluralscape/db/pg";
import { now } from "@pluralscape/types";
import { and, eq, isNull, lte, or, sql } from "drizzle-orm";

import { buildIpPinnedFetchArgs, resolveAndValidateUrl } from "../lib/ip-validation.js";
import { logger } from "../lib/logger.js";
import {
  HTTP_SUCCESS_MAX,
  HTTP_SUCCESS_MIN,
  MS_PER_SECOND,
  WEBHOOK_BASE_BACKOFF_MS,
  WEBHOOK_DEFAULT_JITTER_FRACTION,
  WEBHOOK_DELIVERY_TIMEOUT_MS,
  WEBHOOK_HMAC_ALGORITHM,
  WEBHOOK_MAX_RETRY_ATTEMPTS,
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_TIMESTAMP_HEADER,
} from "../service.constants.js";

import type { WebhookDeliveryId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/**
 * Compute HMAC-SHA256 signature for a webhook payload using the config's secret.
 */
export function computeWebhookSignature(
  secret: Buffer,
  timestamp: number,
  payload: string,
): string {
  return createHmac(WEBHOOK_HMAC_ALGORITHM, secret)
    .update(`${String(timestamp)}.${payload}`)
    .digest("hex");
}

/**
 * Calculate exponential backoff delay for the given attempt number.
 * Uses 2^attempt * baseMs (e.g. 1s, 2s, 4s, 8s, 16s) with optional jitter.
 */
export function calculateBackoffMs(
  attemptCount: number,
  baseMs: number,
  jitterFraction = WEBHOOK_DEFAULT_JITTER_FRACTION,
): number {
  const delay = Math.pow(2, attemptCount) * baseMs;
  const jitter = delay * jitterFraction * (2 * Math.random() - 1);
  return Math.max(0, Math.round(delay + jitter));
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
  // Load delivery and associated config in a single query
  const [row] = await db
    .select({
      id: webhookDeliveries.id,
      webhookId: webhookDeliveries.webhookId,
      systemId: webhookDeliveries.systemId,
      eventType: webhookDeliveries.eventType,
      attemptCount: webhookDeliveries.attemptCount,
      configUrl: webhookConfigs.url,
      configSecret: webhookConfigs.secret,
      configEnabled: webhookConfigs.enabled,
    })
    .from(webhookDeliveries)
    .leftJoin(webhookConfigs, eq(webhookDeliveries.webhookId, webhookConfigs.id))
    .where(eq(webhookDeliveries.id, deliveryId))
    .limit(1);

  if (!row) {
    logger.warn(`[webhook-worker] delivery not found: ${deliveryId}`);
    return;
  }

  // If config is missing or disabled, mark delivery as failed
  if (!row.configUrl || !row.configEnabled) {
    if (!row.configUrl) {
      logger.warn(
        `[webhook-worker] config not found for delivery ${deliveryId}, webhook ${row.webhookId}`,
      );
    } else {
      logger.warn(
        `[webhook-worker] config disabled for delivery ${deliveryId}, webhook ${row.webhookId}`,
      );
    }
    await db
      .update(webhookDeliveries)
      .set({
        status: "failed",
        lastAttemptAt: now(),
      })
      .where(eq(webhookDeliveries.id, deliveryId));
    return;
  }

  // Narrow the config fields — guaranteed non-null after the enabled check above.
  const configUrl = row.configUrl;
  const configSecret = row.configSecret;
  if (!configSecret) {
    logger.warn("[webhook-worker] config secret missing for delivery", { deliveryId });
    await db
      .update(webhookDeliveries)
      .set({ status: "failed", lastAttemptAt: now() })
      .where(eq(webhookDeliveries.id, deliveryId));
    return;
  }

  // Resolve DNS and validate IPs, then pin to the resolved IP to prevent rebinding.
  let pinnedUrl: string;
  let hostHeader: string;
  try {
    const resolvedIps = await resolveAndValidateUrl(configUrl);
    const firstIp = resolvedIps[0];
    if (!firstIp) throw new Error("Webhook URL hostname resolved to no IPs");
    ({ pinnedUrl, hostHeader } = buildIpPinnedFetchArgs(configUrl, firstIp));
  } catch (error: unknown) {
    logger.warn("[webhook-worker] SSRF validation failed for delivery", {
      deliveryId,
      url: configUrl,
      reason: error instanceof Error ? error.message : String(error),
    });
    await db
      .update(webhookDeliveries)
      .set({ status: "failed", lastAttemptAt: now() })
      .where(eq(webhookDeliveries.id, deliveryId));
    return;
  }

  const payloadJson = JSON.stringify(payload);
  const timestamp = now();
  const deliveryTimestamp = Math.floor(Date.now() / MS_PER_SECOND);
  const signature = computeWebhookSignature(
    Buffer.from(configSecret),
    deliveryTimestamp,
    payloadJson,
  );

  let httpStatus: number | null = null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, WEBHOOK_DELIVERY_TIMEOUT_MS);

    try {
      const response = await fetchFn(pinnedUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Host: hostHeader,
          [WEBHOOK_SIGNATURE_HEADER]: signature,
          [WEBHOOK_TIMESTAMP_HEADER]: String(deliveryTimestamp),
        },
        body: payloadJson,
        signal: controller.signal,
      });
      httpStatus = response.status;
    } finally {
      clearTimeout(timeout);
    }
  } catch (error: unknown) {
    // Only swallow network/timeout errors — re-throw unexpected errors
    if (
      !(
        error instanceof TypeError ||
        (error instanceof DOMException && error.name === "AbortError")
      )
    ) {
      throw error;
    }
    // Network or timeout error — httpStatus stays null
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

  // Failure path — use atomic increment for consistency
  if (row.attemptCount + 1 >= WEBHOOK_MAX_RETRY_ATTEMPTS) {
    await db
      .update(webhookDeliveries)
      .set({
        status: "failed",
        httpStatus,
        lastAttemptAt: timestamp,
        attemptCount: sql`${webhookDeliveries.attemptCount} + 1`,
      })
      .where(eq(webhookDeliveries.id, deliveryId));
    return;
  }

  const backoffMs = calculateBackoffMs(row.attemptCount + 1, WEBHOOK_BASE_BACKOFF_MS);
  const nextRetryAt = timestamp + backoffMs;

  await db
    .update(webhookDeliveries)
    .set({
      httpStatus,
      lastAttemptAt: timestamp,
      attemptCount: sql`${webhookDeliveries.attemptCount} + 1`,
      nextRetryAt,
    })
    .where(eq(webhookDeliveries.id, deliveryId));
}

/**
 * Query delivery records ready for retry (status = 'pending' and nextRetryAt <= now).
 * Used by the delivery worker to find work.
 */
export async function findPendingDeliveries(
  db: PostgresJsDatabase,
  limit: number,
): Promise<readonly { id: string; webhookId: string; systemId: string; eventType: string }[]> {
  return db
    .select({
      id: webhookDeliveries.id,
      webhookId: webhookDeliveries.webhookId,
      systemId: webhookDeliveries.systemId,
      eventType: webhookDeliveries.eventType,
    })
    .from(webhookDeliveries)
    .where(
      and(
        eq(webhookDeliveries.status, "pending"),
        or(isNull(webhookDeliveries.nextRetryAt), lte(webhookDeliveries.nextRetryAt, now())),
      ),
    )
    .limit(limit);
}
