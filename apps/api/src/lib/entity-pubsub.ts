import { getNotificationPubSub } from "./notification-pubsub.js";

import type { EntityChangeEvent, SystemId } from "@pluralscape/types";

/**
 * Publish an entity change event to the Valkey pub/sub channel for a system.
 * Channel format: `entity-change:{systemId}:{entity}`
 */
export async function publishEntityChange(
  systemId: SystemId,
  event: EntityChangeEvent,
): Promise<boolean> {
  const pubsub = getNotificationPubSub();
  if (!pubsub) return false;
  const channel = `entity-change:${systemId}:${event.entity}`;
  return pubsub.publish(channel, JSON.stringify(event));
}

/**
 * Subscribe to entity change events for a system and entity type.
 * Returns the unsubscribe function, or null if pub/sub is not configured.
 */
export async function subscribeToEntityChanges(
  systemId: SystemId,
  entity: EntityChangeEvent["entity"],
  handler: (event: EntityChangeEvent) => void,
): Promise<(() => Promise<void>) | null> {
  const pubsub = getNotificationPubSub();
  if (!pubsub) return null;
  const channel = `entity-change:${systemId}:${entity}`;
  const messageHandler = (message: string): void => {
    const parsed = JSON.parse(message) as EntityChangeEvent;
    handler(parsed);
  };
  await pubsub.subscribe(channel, messageHandler);
  return async () => {
    await pubsub.unsubscribe(channel, messageHandler);
  };
}
