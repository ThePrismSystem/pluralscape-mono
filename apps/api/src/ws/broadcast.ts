/**
 * Broadcast document updates to subscribed WebSocket connections.
 *
 * Local delivery only in Phase 1. Valkey pub/sub fan-out for
 * cross-instance delivery is added in Task 6 (api-5801).
 */
import { serializeServerMessage } from "./serialization.js";
import { WS_CLOSE_UNEXPECTED } from "./ws.constants.js";

import type { ConnectionManager } from "./connection-manager.js";
import type { AppLogger } from "../lib/logger.js";
import type { DocumentUpdate } from "@pluralscape/sync";

/**
 * Broadcast a DocumentUpdate to all subscribers of a document,
 * excluding the connection that submitted the change (no self-echo).
 */
export function broadcastDocumentUpdate(
  update: DocumentUpdate,
  excludeConnectionId: string,
  manager: ConnectionManager,
  log: AppLogger,
): void {
  const subscribers = manager.getSubscribers(update.docId);
  if (subscribers.size === 0) return;

  const serialized = serializeServerMessage(update);
  let delivered = 0;
  const deadConnections: string[] = [];

  for (const connectionId of subscribers) {
    if (connectionId === excludeConnectionId) continue;

    const state = manager.get(connectionId);
    if (state?.phase !== "authenticated") continue;

    try {
      state.ws.send(serialized);
      delivered++;
    } catch {
      log.warn("Failed to deliver DocumentUpdate", {
        connectionId,
        docId: update.docId,
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
          error: closeErr instanceof Error ? closeErr.message : String(closeErr),
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
}
