/**
 * WebSocket protocol message handlers.
 *
 * All handlers for the authenticated phase of the sync protocol, consolidated
 * into a single module for import simplicity.
 */
import { SNAPSHOT_VERSION_CONFLICT_MESSAGE } from "@pluralscape/sync";

import type { ConnectionManager } from "./connection-manager.js";
import type { SyncConnectionState } from "./connection-state.js";
import type { EncryptedRelay } from "@pluralscape/sync";
import type {
  ChangeAccepted,
  ChangesResponse,
  DocumentLoadRequest,
  EncryptedChangeEnvelope,
  FetchChangesRequest,
  FetchSnapshotRequest,
  ManifestRequest,
  ManifestResponse,
  SnapshotAccepted,
  SnapshotResponse,
  SubmitChangeRequest,
  SubmitSnapshotRequest,
  SubscribeRequest,
  SubscribeResponse,
  SyncError,
  UnsubscribeRequest,
} from "@pluralscape/sync";

// ── Manifest ────────────────────────────────────────────────────────

/** Handle a ManifestRequest. Phase 1: returns empty manifest stub. */
export function handleManifestRequest(message: ManifestRequest): ManifestResponse | SyncError {
  return {
    type: "ManifestResponse",
    correlationId: message.correlationId,
    manifest: { documents: [], systemId: message.systemId },
  };
}

// ── Subscribe / Unsubscribe ─────────────────────────────────────────

/** Handle a SubscribeRequest. Registers subscriptions and computes catch-up. */
export function handleSubscribeRequest(
  message: SubscribeRequest,
  state: SyncConnectionState,
  manager: ConnectionManager,
  relay: EncryptedRelay,
): SubscribeResponse {
  const catchup = [];

  for (const entry of message.documents) {
    if (!manager.addSubscription(state.connectionId, entry.docId)) {
      // Subscription cap reached — skip this document silently
      continue;
    }

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

// ── Fetch ───────────────────────────────────────────────────────────

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

// ── Submit ──────────────────────────────────────────────────────────

/** Result of handling a SubmitChangeRequest, including the sequenced envelope for broadcast. */
export interface SubmitChangeResult {
  readonly response: ChangeAccepted;
  readonly sequencedEnvelope: EncryptedChangeEnvelope;
}

/** Handle a SubmitChangeRequest. Returns ChangeAccepted and the sequenced envelope. */
export function handleSubmitChange(
  message: SubmitChangeRequest,
  relay: EncryptedRelay,
): SubmitChangeResult {
  const assignedSeq = relay.submit({
    ...message.change,
    documentId: message.docId,
  });

  return {
    response: {
      type: "ChangeAccepted",
      correlationId: message.correlationId,
      docId: message.docId,
      assignedSeq,
    },
    sequencedEnvelope: {
      ...message.change,
      documentId: message.docId,
      seq: assignedSeq,
    },
  };
}

/** Handle a SubmitSnapshotRequest. Returns SnapshotAccepted or SyncError on conflict. */
export function handleSubmitSnapshot(
  message: SubmitSnapshotRequest,
  relay: EncryptedRelay,
): SnapshotAccepted | SyncError {
  try {
    relay.submitSnapshot({ ...message.snapshot, documentId: message.docId });
    return {
      type: "SnapshotAccepted",
      correlationId: message.correlationId,
      docId: message.docId,
      snapshotVersion: message.snapshot.snapshotVersion,
    };
  } catch (err) {
    if (err instanceof Error && err.message.includes(SNAPSHOT_VERSION_CONFLICT_MESSAGE)) {
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

// ── Document Load ───────────────────────────────────────────────────

/**
 * Handle a DocumentLoadRequest (on-demand document load).
 *
 * Returns both snapshot and changes for the requested document.
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
