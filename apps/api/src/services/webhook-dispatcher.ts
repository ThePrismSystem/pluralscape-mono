import { webhookConfigs, webhookDeliveries } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now } from "@pluralscape/types";
import { and, eq } from "drizzle-orm";

import type { SystemId, WebhookEventPayloadMap, WebhookEventType } from "@pluralscape/types";
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
export async function dispatchWebhookEvent<K extends WebhookEventType>(
  db: PostgresJsDatabase,
  systemId: SystemId,
  eventType: K,
  payload: Readonly<WebhookEventPayloadMap[K]>,
): Promise<readonly string[]> {
  return db.transaction(async (tx) => {
    // Find all enabled, non-archived configs for this system that subscribe to this event
    const configs = await tx
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

    await tx.insert(webhookDeliveries).values(values);

    return deliveryIds;
  });
}
