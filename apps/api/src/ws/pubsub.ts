/**
 * Singleton accessor for the ValkeyPubSub instance.
 *
 * Call `initPubSub(serverId)` at server startup to create the instance.
 * Use `getPubSub()` from route handlers and services to access it.
 * Returns null when Valkey is unavailable — callers must handle gracefully.
 */

import { ValkeyPubSub } from "./valkey-pubsub.js";

let instance: ValkeyPubSub | null = null;

/** Initialize the singleton ValkeyPubSub instance. */
export function initPubSub(serverId: string): ValkeyPubSub {
  if (instance) return instance;
  instance = new ValkeyPubSub(serverId);
  return instance;
}

/** Get the ValkeyPubSub singleton, or null if not initialized. */
export function getPubSub(): ValkeyPubSub | null {
  return instance;
}

/** Reset the singleton (for testing). */
export function _resetPubSubForTesting(): void {
  instance = null;
}
