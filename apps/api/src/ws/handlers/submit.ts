import type { EncryptedRelay } from "@pluralscape/sync";
import type {
  ChangeAccepted,
  SnapshotAccepted,
  SubmitChangeRequest,
  SubmitSnapshotRequest,
  SyncError,
} from "@pluralscape/sync";

/** Handle a SubmitChangeRequest. Returns ChangeAccepted on success. */
export function handleSubmitChange(
  message: SubmitChangeRequest,
  relay: EncryptedRelay,
): ChangeAccepted {
  const assignedSeq = relay.submit({
    ...message.change,
    documentId: message.docId,
  });

  return {
    type: "ChangeAccepted",
    correlationId: message.correlationId,
    docId: message.docId,
    assignedSeq,
  };
}

/** Handle a SubmitSnapshotRequest. Returns SnapshotAccepted or SyncError on conflict. */
export function handleSubmitSnapshot(
  message: SubmitSnapshotRequest,
  relay: EncryptedRelay,
): SnapshotAccepted | SyncError {
  try {
    relay.submitSnapshot(message.snapshot);
    return {
      type: "SnapshotAccepted",
      correlationId: message.correlationId,
      docId: message.docId,
      snapshotVersion: message.snapshot.snapshotVersion,
    };
  } catch (err) {
    if (err instanceof Error && err.message.includes("is not newer than current version")) {
      return {
        type: "SyncError",
        correlationId: message.correlationId,
        code: "VERSION_CONFLICT",
        message: "Snapshot version is not newer than current version",
        docId: message.docId,
      };
    }
    throw err;
  }
}
