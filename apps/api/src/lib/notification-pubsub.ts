/**
 * Singleton notification pub/sub for SSE event delivery.
 *
 * Follows the same set/get pattern as setRateLimitStore() — call
 * setNotificationPubSub() at startup, then getNotificationPubSub()
 * from route handlers.
 */

/** Minimal interface required by SSE and entity-change pub/sub consumers. */
export interface NotificationPubSub {
  publish(channel: string, message: string): Promise<boolean>;
  subscribe(
    channel: string,
    handler: (message: string) => void,
  ): Promise<"subscribed" | "deferred" | "failed">;
  unsubscribe(channel: string, handler?: (message: string) => void): Promise<void>;
}

let notificationPubSub: NotificationPubSub | undefined;

/** Set the notification pub/sub instance (call at startup). */
export function setNotificationPubSub(pubsub: NotificationPubSub): void {
  notificationPubSub = pubsub;
}

/** Get the notification pub/sub instance. Returns undefined if not configured. */
export function getNotificationPubSub(): NotificationPubSub | undefined {
  return notificationPubSub;
}

/** Reset the notification pub/sub (for testing). */
export function _resetNotificationPubSubForTesting(): void {
  notificationPubSub = undefined;
}
