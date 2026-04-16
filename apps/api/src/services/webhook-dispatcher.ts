import { getSodium } from "@pluralscape/crypto";
import { webhookConfigs, webhookDeliveries } from "@pluralscape/db/pg";
import { brandId, ID_PREFIXES, createId, now } from "@pluralscape/types";
import { and, eq } from "drizzle-orm";

import { WEBHOOK_CONFIGS_CACHE_TTL_MS } from "../lib/cache.constants.js";
import { QueryCache } from "../lib/query-cache.js";

import {
  encryptWebhookPayload,
  getWebhookPayloadEncryptionKey,
} from "./webhook-payload-encryption.js";

import type {
  SystemId,
  WebhookDeliveryId,
  WebhookEventPayloadMap,
  WebhookEventType,
  WebhookId,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Cache ───────────────────────────────────────────────────────────

interface CachedWebhookConfig {
  readonly id: WebhookId;
  readonly eventTypes: readonly WebhookEventType[];
}

const webhookConfigCache = new QueryCache<readonly CachedWebhookConfig[]>(
  WEBHOOK_CONFIGS_CACHE_TTL_MS,
);

/** Invalidate cached webhook configs for a system (call on any config mutation). */
export function invalidateWebhookConfigCache(systemId: SystemId): void {
  webhookConfigCache.invalidate(systemId);
}

/** Clear all cached webhook configs (for test teardown). */
export function clearWebhookConfigCache(): void {
  webhookConfigCache.clear();
}

// ── Dispatch ────────────────────────────────────────────────────────

/** Runtime check: PgTransaction has rollback(), raw PgDatabase does not. */
function isTransaction(db: PostgresJsDatabase): boolean {
  return "rollback" in db;
}

/** Core dispatch logic — runs on whatever db/tx handle is passed. */
async function executeDispatch<K extends WebhookEventType>(
  db: PostgresJsDatabase,
  systemId: SystemId,
  eventType: K,
  payload: Readonly<WebhookEventPayloadMap[K]>,
  inTransaction: boolean,
): Promise<readonly WebhookDeliveryId[]> {
  // Check cache first; fall back to DB query on miss
  const cached = webhookConfigCache.get(systemId);
  let configs: readonly CachedWebhookConfig[];
  if (cached !== undefined) {
    configs = cached;
  } else {
    const rows = await db
      .select({
        id: webhookConfigs.id,
        eventTypes: webhookConfigs.eventTypes,
      })
      .from(webhookConfigs)
      .where(
        and(
          eq(webhookConfigs.systemId, systemId),
          eq(webhookConfigs.enabled, true),
          eq(webhookConfigs.archived, false),
        ),
      );
    configs = rows.map((row) => ({ id: brandId<WebhookId>(row.id), eventTypes: row.eventTypes }));
    // Only populate cache from committed data — transaction-scoped reads
    // may see uncommitted state that would become stale on rollback.
    if (!inTransaction) {
      webhookConfigCache.set(systemId, configs);
    }
  }

  // Filter configs that subscribe to this specific event type
  // (JSONB containment would be ideal, but filtering in-app is fine for the
  // expected cardinality of webhook configs per system)
  const matchingConfigs = configs.filter((config) => config.eventTypes.includes(eventType));

  if (matchingConfigs.length === 0) {
    return [];
  }

  const timestamp = now();
  const deliveryIds: WebhookDeliveryId[] = [];
  const payloadJson = JSON.stringify({ ...payload, systemId });
  const encryptionKey = getWebhookPayloadEncryptionKey();

  try {
    // Encrypt once — same ciphertext for all delivery records (identical payload).
    const encryptedData = encryptWebhookPayload(payloadJson, encryptionKey);

    const values = matchingConfigs.map((config) => {
      const deliveryId = brandId<WebhookDeliveryId>(createId(ID_PREFIXES.webhookDelivery));
      deliveryIds.push(deliveryId);
      return {
        id: deliveryId,
        webhookId: config.id,
        systemId,
        eventType,
        status: "pending" as const,
        attemptCount: 0,
        createdAt: timestamp,
        encryptedData,
      };
    });

    await db.insert(webhookDeliveries).values(values);
  } finally {
    // Zeros the derived Uint8Array; the hex source in process.env is not erasable.
    getSodium().memzero(encryptionKey);
  }

  return deliveryIds;
}

/**
 * Dispatch a webhook event for a system. Queries enabled, non-archived webhook
 * configs that subscribe to the given event type and creates a pending delivery
 * record for each match.
 *
 * Returns the IDs of created delivery records (empty if no configs matched).
 *
 * When called with a transaction handle (the normal case from service code),
 * executes directly on that handle. When called with a raw db connection,
 * wraps in a transaction for atomicity between the config SELECT and delivery INSERT.
 *
 * NOTE: Job enqueueing (BullMQ) is intentionally deferred until the queue
 * infrastructure is wired up. For now, deliveries are created with status
 * 'pending' and can be picked up by a polling worker or future job integration.
 */
export async function dispatchWebhookEvent<K extends WebhookEventType>(
  db: PostgresJsDatabase,
  systemId: SystemId,
  eventType: K,
  payload: Readonly<WebhookEventPayloadMap[K]>,
): Promise<readonly WebhookDeliveryId[]> {
  if (isTransaction(db)) {
    return executeDispatch(db, systemId, eventType, payload, true);
  }
  return db.transaction((tx) => executeDispatch(tx, systemId, eventType, payload, false));
}
