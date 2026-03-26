import { webhookConfigs, webhookDeliveries } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now } from "@pluralscape/types";
import { and, eq } from "drizzle-orm";

import type { SystemId, WebhookEventPayloadMap, WebhookEventType } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

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
): Promise<readonly string[]> {
  // Find all enabled, non-archived configs for this system that subscribe to this event
  const configs = await db
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

  // Filter configs that subscribe to this specific event type
  // (JSONB containment would be ideal, but filtering in-app is fine for the
  // expected cardinality of webhook configs per system)
  const matchingConfigs = configs.filter((config) => config.eventTypes.includes(eventType));

  if (matchingConfigs.length === 0) {
    return [];
  }

  const timestamp = now();
  const deliveryIds: string[] = [];

  const values = matchingConfigs.map((config) => {
    const deliveryId = createId(ID_PREFIXES.webhookDelivery);
    deliveryIds.push(deliveryId);
    return {
      id: deliveryId,
      webhookId: config.id,
      systemId,
      eventType,
      status: "pending" as const,
      attemptCount: 0,
      payloadData: { ...payload, systemId },
      createdAt: timestamp,
    };
  });

  await db.insert(webhookDeliveries).values(values);

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
): Promise<readonly string[]> {
  if (isTransaction(db)) {
    return executeDispatch(db, systemId, eventType, payload);
  }
  return db.transaction((tx) => executeDispatch(tx, systemId, eventType, payload));
}
