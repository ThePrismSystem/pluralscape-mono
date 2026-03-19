import type { EncryptedRelay } from "@pluralscape/sync";
import type {
  ChangesResponse,
  FetchChangesRequest,
  FetchSnapshotRequest,
  SnapshotResponse,
} from "@pluralscape/sync";

/** Handle a FetchSnapshotRequest. */
export function handleFetchSnapshot(
  message: FetchSnapshotRequest,
  relay: EncryptedRelay,
): SnapshotResponse {
  return {
    type: "SnapshotResponse",
    correlationId: message.correlationId,
    docId: message.docId,
    snapshot: relay.getLatestSnapshot(message.docId),
  };
}

/** Handle a FetchChangesRequest. */
export function handleFetchChanges(
  message: FetchChangesRequest,
  relay: EncryptedRelay,
): ChangesResponse {
  return {
    type: "ChangesResponse",
    correlationId: message.correlationId,
    docId: message.docId,
    changes: relay.getEnvelopesSince(message.docId, message.sinceSeq),
  };
}
