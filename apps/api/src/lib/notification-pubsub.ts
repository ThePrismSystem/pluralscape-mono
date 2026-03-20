/**
 * Singleton notification pub/sub for SSE event delivery.
 *
 * Follows the same set/get pattern as setRateLimitStore() — call
 * setNotificationPubSub() at startup, then getNotificationPubSub()
 * from route handlers.
 */
import type { ValkeyPubSub } from "../ws/valkey-pubsub.js";

let notificationPubSub: ValkeyPubSub | undefined;

/** Set the notification pub/sub instance (call at startup). */
export function setNotificationPubSub(pubsub: ValkeyPubSub): void {
  notificationPubSub = pubsub;
}

/** Get the notification pub/sub instance. Returns undefined if not configured. */
export function getNotificationPubSub(): ValkeyPubSub | undefined {
  return notificationPubSub;
}

/** Reset the notification pub/sub (for testing). */
export function _resetNotificationPubSubForTesting(): void {
  notificationPubSub = undefined;
}
