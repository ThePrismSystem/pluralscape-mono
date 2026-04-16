import { createHmac } from "node:crypto";

import { getSodium } from "@pluralscape/crypto";
import { webhookConfigs, webhookDeliveries } from "@pluralscape/db/pg";
import { now } from "@pluralscape/types";
import { and, eq, isNull, lte, or, sql } from "drizzle-orm";

import { buildIpPinnedFetchArgs, resolveAndValidateUrl } from "../lib/ip-validation.js";
import { logger } from "../lib/logger.js";
import { sendSignedWebhookRequest } from "../lib/webhook-fetch.js";
import {
  HTTP_SUCCESS_MAX,
  HTTP_SUCCESS_MIN,
  MS_PER_SECOND,
  WEBHOOK_BASE_BACKOFF_MS,
  WEBHOOK_DEFAULT_JITTER_FRACTION,
  WEBHOOK_HMAC_ALGORITHM,
  WEBHOOK_HOST_THROTTLE_DELAY_MS,
  WEBHOOK_MAX_RETRY_ATTEMPTS,
  WEBHOOK_PER_HOST_MAX_CONCURRENT,
} from "../service.constants.js";

import {
  decryptWebhookPayload,
  getWebhookPayloadEncryptionKey,
} from "./webhook-payload-encryption.js";

import type { FetchFn } from "../lib/webhook-fetch.js";
import type { SystemId, WebhookDeliveryId, WebhookEventType, WebhookId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Per-hostname concurrency throttle ──────────────────────────────

const hostSlots = new Map<string, number>();

/** Try to acquire a concurrency slot for the given hostname. */
export function acquireHostSlot(hostname: string): boolean {
  const current = hostSlots.get(hostname) ?? 0;
  if (current >= WEBHOOK_PER_HOST_MAX_CONCURRENT) {
    return false;
  }
  hostSlots.set(hostname, current + 1);
  return true;
}

/** Release a concurrency slot for the given hostname. */
export function releaseHostSlot(hostname: string): void {
  const current = hostSlots.get(hostname) ?? 0;
  if (current <= 0) {
    logger.debug("[webhook-worker] releasing host slot for hostname with no active slots", {
      hostname,
    });
    hostSlots.delete(hostname);
  } else if (current <= 1) {
    hostSlots.delete(hostname);
  } else {
    hostSlots.set(hostname, current - 1);
  }
}

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

/** Mark a delivery as failed (early-exit paths only — no attemptCount increment). */
async function markDeliveryFailed(
  db: PostgresJsDatabase,
  deliveryId: WebhookDeliveryId,
): Promise<void> {
  await db
    .update(webhookDeliveries)
    .set({ status: "failed", lastAttemptAt: now() })
    .where(eq(webhookDeliveries.id, deliveryId));
}

/**
 * Process a single pending webhook delivery.
 *
 * 1. Fetches the delivery row (including payload) and associated webhook config.
 * 2. Decrypts the encrypted payload using the server-held encryption key.
 * 3. Sends an HTTP POST with the JSON payload and HMAC signature header.
 * 4. On success (2xx): marks the delivery as 'success'.
 * 5. On failure: increments attempt count and schedules retry with exponential backoff.
 * 6. After max attempts: marks the delivery as 'failed'.
 */
export async function processWebhookDelivery(
  db: PostgresJsDatabase,
  deliveryId: WebhookDeliveryId,
  fetchFn: FetchFn = fetch,
): Promise<void> {
  // Load delivery and associated config in a single query
  const [row] = await db
    .select({
      id: webhookDeliveries.id,
      webhookId: webhookDeliveries.webhookId,
      systemId: webhookDeliveries.systemId,
      eventType: webhookDeliveries.eventType,
      attemptCount: webhookDeliveries.attemptCount,
      encryptedData: webhookDeliveries.encryptedData,
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
    await markDeliveryFailed(db, deliveryId);
    return;
  }

  // Narrow the config fields — guaranteed non-null after the enabled check above.
  const configUrl = row.configUrl;
  const configSecret = row.configSecret;
  if (!configSecret) {
    logger.warn("[webhook-worker] config secret missing for delivery", { deliveryId });
    await markDeliveryFailed(db, deliveryId);
    return;
  }

  // Decrypt payload
  let payloadJson: string;
  try {
    const key = getWebhookPayloadEncryptionKey();
    try {
      payloadJson = decryptWebhookPayload(row.encryptedData, key);
    } finally {
      getSodium().memzero(key);
    }
  } catch (err: unknown) {
    logger.warn("[webhook-worker] payload decryption failed for delivery", {
      deliveryId,
      reason: err instanceof Error ? err.message : String(err),
    });
    await markDeliveryFailed(db, deliveryId);
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
    await markDeliveryFailed(db, deliveryId);
    return;
  }

  // Per-hostname concurrency throttle — defer delivery if at capacity
  const hostname = new URL(configUrl).hostname;
  if (!acquireHostSlot(hostname)) {
    logger.warn("[webhook-worker] host concurrency limit reached, deferring delivery", {
      deliveryId,
      hostname,
    });
    await db
      .update(webhookDeliveries)
      .set({ nextRetryAt: now() + WEBHOOK_HOST_THROTTLE_DELAY_MS })
      .where(eq(webhookDeliveries.id, deliveryId));
    return;
  }

  const timestamp = now();
  const deliveryTimestamp = Math.floor(Date.now() / MS_PER_SECOND);

  const secretBuffer = Buffer.from(configSecret);
  try {
    const signature = computeWebhookSignature(secretBuffer, deliveryTimestamp, payloadJson);

    const result = await sendSignedWebhookRequest({
      url: pinnedUrl,
      signature,
      timestamp: deliveryTimestamp,
      payloadJson,
      fetchFn,
      hostHeader: pinnedUrl !== configUrl ? hostHeader : undefined,
    });

    const httpStatus = "httpStatus" in result ? result.httpStatus : null;
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
  } finally {
    secretBuffer.fill(0);
    releaseHostSlot(hostname);
  }
}

/**
 * Query delivery records ready for retry (status = 'pending' and nextRetryAt <= now).
 * Used by the delivery worker to find work.
 *
 * This is a background worker query that intentionally queries across all
 * systems without tenant scoping. The worker processes deliveries globally
 * and does not operate within a single tenant's RLS context.
 */
export async function findPendingDeliveries(
  db: PostgresJsDatabase,
  limit: number,
): Promise<
  readonly {
    id: WebhookDeliveryId;
    webhookId: WebhookId;
    systemId: SystemId;
    eventType: WebhookEventType;
  }[]
> {
  const rows = await db
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

  return rows as {
    id: WebhookDeliveryId;
    webhookId: WebhookId;
    systemId: SystemId;
    eventType: WebhookEventType;
  }[];
}
