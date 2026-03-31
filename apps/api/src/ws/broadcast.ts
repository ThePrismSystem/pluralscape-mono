/**
 * Broadcast document updates to subscribed WebSocket connections.
 *
 * Supports both local-only delivery and cross-instance fan-out via
 * Valkey pub/sub. When a ValkeyPubSub instance is provided,
 * broadcastDocumentUpdateWithSync publishes the update to Valkey so
 * other server instances can deliver to their local subscribers.
 */
import { serializeServerMessage } from "./serialization.js";
import { VALKEY_CHANNEL_PREFIX_SYNC, WS_CLOSE_UNEXPECTED } from "./ws.constants.js";
import { formatError } from "./ws.utils.js";

import type { ConnectionManager } from "./connection-manager.js";
import type { AppLogger } from "../lib/logger.js";
import type { DocumentUpdate } from "@pluralscape/sync";

/** Minimal pub/sub interface for cross-instance broadcast (decoupled from ValkeyPubSub). */
export interface SyncBroadcastPubSub {
  /** Server ID for deduplication (skip self-published messages). */
  readonly id: string;
  /** Publish a message to a channel. Returns false if publish failed. */
  publish(channel: string, message: string): Promise<boolean>;
}

/** Result of a broadcast operation. */
export interface BroadcastResult {
  readonly delivered: number;
  readonly failed: number;
  readonly total: number;
  /** Whether the update was published to Valkey for cross-instance fan-out. null = no pubsub configured. */
  readonly syncPublished: boolean | null;
}

/**
 * Broadcast a DocumentUpdate to all subscribers of a document,
 * excluding the connection that submitted the change (no self-echo).
 */
export function broadcastDocumentUpdate(
  update: DocumentUpdate,
  excludeConnectionId: string,
  manager: ConnectionManager,
  log: AppLogger,
): BroadcastResult {
  const subscribers = manager.getSubscribers(update.docId);
  if (subscribers.size === 0) return { delivered: 0, failed: 0, total: 0, syncPublished: null };

  // C2: Wrap serialization in try/catch — log and return early on failure
  let serialized: string;
  try {
    serialized = serializeServerMessage(update);
  } catch (err: unknown) {
    log.error("Failed to serialize DocumentUpdate for broadcast", {
      docId: update.docId,
      error: formatError(err),
    });
    return { delivered: 0, failed: subscribers.size, total: subscribers.size, syncPublished: null };
  }

  let delivered = 0;
  const deadConnections: string[] = [];

  for (const connectionId of subscribers) {
    if (connectionId === excludeConnectionId) continue;

    const state = manager.get(connectionId);
    if (state?.phase !== "authenticated") continue;

    try {
      state.ws.send(serialized);
      delivered++;
    } catch (err: unknown) {
      log.warn("Failed to deliver DocumentUpdate", {
        connectionId,
        docId: update.docId,
        error: formatError(err),
      });
      deadConnections.push(connectionId);
    }
  }

  // Close and remove dead connections after iteration to avoid mutating the Set during loop
  for (const connectionId of deadConnections) {
    const state = manager.get(connectionId);
    if (state) {
      try {
        state.ws.close(WS_CLOSE_UNEXPECTED, "Send failed");
      } catch (closeErr: unknown) {
        log.debug("Failed to close dead WebSocket", {
          connectionId,
          error: formatError(closeErr),
        });
      }
    }
    manager.remove(connectionId);
  }

  if (delivered > 0) {
    log.debug("Broadcast DocumentUpdate", {
      docId: update.docId,
      subscribers: subscribers.size,
      delivered,
      excluded: excludeConnectionId,
    });
  }

  return {
    delivered,
    failed: deadConnections.length,
    total: subscribers.size,
    syncPublished: null,
  };
}

/** Wire-format payload published to Valkey for cross-instance fan-out. */
interface ValkeyBroadcastMessage {
  /** Originating server ID — recipients skip messages from themselves. */
  readonly serverId: string;
  /** The DocumentUpdate to deliver to local subscribers on other instances. */
  readonly update: DocumentUpdate;
}

/**
 * Broadcast a DocumentUpdate locally and publish to Valkey for cross-instance delivery.
 *
 * Performs local delivery first (synchronous, low-latency), then publishes
 * to Valkey asynchronously. If pubsub is null (Valkey unavailable), falls
 * back to local-only delivery gracefully.
 */
export async function broadcastDocumentUpdateWithSync(
  update: DocumentUpdate,
  excludeConnectionId: string,
  manager: ConnectionManager,
  log: AppLogger,
  pubsub: SyncBroadcastPubSub | null,
): Promise<BroadcastResult> {
  // Phase 1: Local delivery (always runs)
  const result = broadcastDocumentUpdate(update, excludeConnectionId, manager, log);

  // Phase 2: Cross-instance fan-out via Valkey (best-effort)
  if (!pubsub) {
    return { ...result, syncPublished: null };
  }

  const channel = `${VALKEY_CHANNEL_PREFIX_SYNC}${update.docId}`;
  const message: ValkeyBroadcastMessage = {
    serverId: pubsub.id,
    update,
  };
  try {
    const published = await pubsub.publish(channel, JSON.stringify(message));
    if (!published) {
      log.warn("Valkey publish returned false for DocumentUpdate", {
        docId: update.docId,
      });
      return { ...result, syncPublished: false };
    }
    return { ...result, syncPublished: true };
  } catch (err: unknown) {
    log.warn("Failed to publish DocumentUpdate to Valkey", {
      docId: update.docId,
      error: formatError(err),
    });
    return { ...result, syncPublished: false };
  }
}
