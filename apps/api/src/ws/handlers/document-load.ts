import type { EncryptedRelay } from "@pluralscape/sync";
import type { ChangesResponse, DocumentLoadRequest, SnapshotResponse } from "@pluralscape/sync";

/**
 * Handle a DocumentLoadRequest (on-demand document load).
 *
 * Returns both snapshot and changes for the requested document.
 * In Phase 1, access checks are not implemented — all authenticated
 * users can load any document. Full access control comes in the CRDT
 * sync epic.
 *
 * Returns two messages: SnapshotResponse then ChangesResponse.
 */
export function handleDocumentLoad(
  message: DocumentLoadRequest,
  relay: EncryptedRelay,
): [SnapshotResponse, ChangesResponse] {
  const snapshot = relay.getLatestSnapshot(message.docId);
  const sinceSeq = 0;
  const changes = relay.getEnvelopesSince(message.docId, sinceSeq);

  return [
    {
      type: "SnapshotResponse",
      correlationId: message.correlationId,
      docId: message.docId,
      snapshot,
    },
    {
      type: "ChangesResponse",
      correlationId: message.correlationId,
      docId: message.docId,
      changes,
    },
  ];
}
