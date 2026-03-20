/**
 * Singleton accessor for the ValkeyPubSub instance.
 *
 * Call `initPubSub(serverId)` at server startup to create the instance.
 * Use `getPubSub()` from route handlers and services to access it.
 * Returns null when Valkey is unavailable — callers must handle gracefully.
 */

import { logger } from "../lib/logger.js";

import { ValkeyPubSub } from "./valkey-pubsub.js";
import { formatError } from "./ws.utils.js";

let instance: ValkeyPubSub | null = null;

/** Initialize the singleton ValkeyPubSub instance. Returns null on failure. */
export function initPubSub(serverId: string): ValkeyPubSub | null {
  if (instance) return instance;
  try {
    instance = new ValkeyPubSub(serverId);
    return instance;
  } catch (err) {
    logger.error("Failed to initialize ValkeyPubSub", { error: formatError(err) });
    return null;
  }
}

/** Get the ValkeyPubSub singleton, or null if not initialized. */
export function getPubSub(): ValkeyPubSub | null {
  return instance;
}

/** Reset the singleton (for testing). */
export function _resetPubSubForTesting(): void {
  instance = null;
}
