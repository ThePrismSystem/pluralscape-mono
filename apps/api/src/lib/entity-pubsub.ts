import { z } from "zod";

import { logger } from "./logger.js";
import { getNotificationPubSub } from "./notification-pubsub.js";

import type { EntityChangeEvent, SystemId } from "@pluralscape/types";

const EntityChangeEventSchema = z.discriminatedUnion("entity", [
  z.object({
    entity: z.literal("message"),
    type: z.enum(["created", "updated", "archived", "deleted"]),
    messageId: z.string(),
    channelId: z.string(),
  }),
  z.object({
    entity: z.literal("boardMessage"),
    type: z.enum(["created", "updated", "archived", "deleted", "pinned", "unpinned", "reordered"]),
    boardMessageId: z.string().optional(),
  }),
  z.object({
    entity: z.literal("poll"),
    type: z.enum(["created", "updated", "closed", "voteCast", "archived", "deleted"]),
    pollId: z.string(),
  }),
  z.object({
    entity: z.literal("acknowledgement"),
    type: z.enum(["created", "updated", "confirmed", "archived", "deleted"]),
    ackId: z.string(),
  }),
]);

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
    let parsed: EntityChangeEvent;
    try {
      parsed = EntityChangeEventSchema.parse(JSON.parse(message)) as EntityChangeEvent;
    } catch {
      logger.error(`[entity-pubsub] Malformed JSON on channel ${channel}:`, { message });
      return;
    }
    handler(parsed);
  };
  await pubsub.subscribe(channel, messageHandler);
  return async () => {
    await pubsub.unsubscribe(channel, messageHandler);
  };
}

/**
 * Async generator that yields entity change events from Valkey pub/sub.
 *
 * Fixes several issues vs inline generators:
 * - JSON.parse is guarded (malformed messages are logged + skipped)
 * - AbortSignal breaks the waiting promise immediately
 * - No race condition between queue drain and resolve installation
 * - Returns immediately if pub/sub is unavailable
 */
export async function* entityChangeGenerator<T extends EntityChangeEvent>(
  systemId: SystemId,
  entity: T["entity"],
  signal: AbortSignal | undefined,
  filter?: (event: T) => boolean,
): AsyncGenerator<T> {
  const queue: T[] = [];
  let resolve: (() => void) | null = null;

  const notify = (): void => {
    resolve?.();
  };

  const unsubscribe = await subscribeToEntityChanges(systemId, entity, (event) => {
    const typed = event as T;
    if (!filter || filter(typed)) {
      queue.push(typed);
      notify();
    }
  });

  // If pub/sub is unavailable, return immediately instead of hanging
  if (unsubscribe === null) return;

  // Break the waiting promise when the signal aborts
  const onAbort = (): void => {
    notify();
  };
  signal?.addEventListener("abort", onAbort);

  try {
    while (!signal?.aborted) {
      // Drain the queue
      while (queue.length > 0) {
        const event = queue.shift();
        if (event) yield event;
      }
      // Wait for next event or abort — resolve is set BEFORE the await
      // so events arriving between drain and await are not lost
      await new Promise<void>((r) => {
        resolve = r;
        // Check queue again after installing resolve to close the race window
        if (queue.length > 0) r();
      });
      resolve = null;
    }
  } finally {
    signal?.removeEventListener("abort", onAbort);
    await unsubscribe();
  }
}
