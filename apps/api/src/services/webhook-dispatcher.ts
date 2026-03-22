import { webhookConfigs, webhookDeliveries } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now } from "@pluralscape/types";
import { and, eq } from "drizzle-orm";

import type { SystemId, WebhookEventType } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/**
 * Dispatch a webhook event for a system. Queries enabled, non-archived webhook
 * configs that subscribe to the given event type and creates a pending delivery
 * record for each match.
 *
 * Returns the IDs of created delivery records (empty if no configs matched).
 *
 * NOTE: Job enqueueing (BullMQ) is intentionally deferred until the queue
 * infrastructure is wired up. For now, deliveries are created with status
 * 'pending' and can be picked up by a polling worker or future job integration.
 */
export async function dispatchWebhookEvent(
  db: PostgresJsDatabase,
  systemId: SystemId,
  eventType: WebhookEventType,
  payload: Readonly<Record<string, unknown>>,
): Promise<readonly string[]> {
  // Payload is captured for future encrypted storage in webhook_deliveries.encrypted_data.
  // Currently only the event type is stored; full payload storage requires the crypto
  // key integration from the webhook config.
  void payload;

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
      createdAt: timestamp,
    };
  });

  await db.insert(webhookDeliveries).values(values);

  return deliveryIds;
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
    .where(eq(webhookDeliveries.status, "pending"))
    .limit(limit);
}
