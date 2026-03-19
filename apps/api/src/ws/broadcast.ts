/**
 * Broadcast document updates to subscribed WebSocket connections.
 *
 * Local delivery only in Phase 1. Valkey pub/sub fan-out for
 * cross-instance delivery is added in Task 6 (api-5801).
 */
import { bytesToBase64url } from "./serialization.js";

import type { ConnectionManager } from "./connection-manager.js";
import type { AppLogger } from "../lib/logger.js";
import type { DocumentUpdate, ServerMessage } from "@pluralscape/sync";

function serializeMessage(msg: ServerMessage): string {
  return JSON.stringify(msg, (_key, value: unknown) => {
    if (value instanceof Uint8Array) {
      return bytesToBase64url(value);
    }
    return value;
  });
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
): void {
  const subscribers = manager.getSubscribers(update.docId);
  if (subscribers.size === 0) return;

  const serialized = serializeMessage(update);
  let delivered = 0;

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
    }
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
