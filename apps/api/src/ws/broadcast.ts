/**
 * Broadcast document updates to subscribed WebSocket connections.
 *
 * Local delivery only in Phase 1. Valkey pub/sub fan-out for
 * cross-instance delivery is added in Task 6 (api-5801).
 */
import { serializeServerMessage } from "./serialization.js";
import { WS_CLOSE_UNEXPECTED } from "./ws.constants.js";
import { formatError } from "./ws.utils.js";

import type { ConnectionManager } from "./connection-manager.js";
import type { AppLogger } from "../lib/logger.js";
import type { DocumentUpdate } from "@pluralscape/sync";

/** Result of a broadcast operation. */
export interface BroadcastResult {
  readonly delivered: number;
  readonly failed: number;
  readonly total: number;
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
  if (subscribers.size === 0) return { delivered: 0, failed: 0, total: 0 };

  // C2: Wrap serialization in try/catch — log and return early on failure
  let serialized: string;
  try {
    serialized = serializeServerMessage(update);
  } catch (err) {
    log.error("Failed to serialize DocumentUpdate for broadcast", {
      docId: update.docId,
      error: formatError(err),
    });
    return { delivered: 0, failed: subscribers.size, total: subscribers.size };
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
    } catch (err) {
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
      } catch (closeErr) {
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

  return { delivered, failed: deadConnections.length, total: subscribers.size };
}
