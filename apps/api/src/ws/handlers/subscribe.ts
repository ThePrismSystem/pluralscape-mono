import type { ConnectionManager } from "../connection-manager.js";
import type { SyncConnectionState } from "../connection-state.js";
import type { EncryptedRelay } from "@pluralscape/sync";
import type { SubscribeRequest, SubscribeResponse, UnsubscribeRequest } from "@pluralscape/sync";

/** Handle a SubscribeRequest. Registers subscriptions and computes catch-up. */
export function handleSubscribeRequest(
  message: SubscribeRequest,
  state: SyncConnectionState,
  manager: ConnectionManager,
  relay: EncryptedRelay,
): SubscribeResponse {
  const catchup = [];

  for (const entry of message.documents) {
    manager.addSubscription(state.connectionId, entry.docId);

    const changes = relay.getEnvelopesSince(entry.docId, entry.lastSyncedSeq);
    const snapshot = relay.getLatestSnapshot(entry.docId);
    const hasNewerSnapshot =
      snapshot !== null && snapshot.snapshotVersion > entry.lastSnapshotVersion;

    if (changes.length > 0 || hasNewerSnapshot) {
      catchup.push({
        docId: entry.docId,
        changes,
        snapshot: hasNewerSnapshot ? snapshot : null,
      });
    }
  }

  return {
    type: "SubscribeResponse",
    correlationId: message.correlationId,
    catchup,
  };
}

/** Handle an UnsubscribeRequest. Removes subscription (idempotent). */
export function handleUnsubscribeRequest(
  message: UnsubscribeRequest,
  state: SyncConnectionState,
  manager: ConnectionManager,
): void {
  manager.removeSubscription(state.connectionId, message.docId);
}
