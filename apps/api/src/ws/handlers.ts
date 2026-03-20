/**
 * WebSocket protocol message handlers.
 *
 * All handlers for the authenticated phase of the sync protocol, consolidated
 * into a single module for import simplicity.
 */
import { SNAPSHOT_VERSION_CONFLICT_MESSAGE } from "@pluralscape/sync";

import type { ConnectionManager } from "./connection-manager.js";
import type { SyncConnectionState } from "./connection-state.js";
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
  SyncRelayService,
  UnsubscribeRequest,
} from "@pluralscape/sync";

// ── Manifest ────────────────────────────────────────────────────────

/** Handle a ManifestRequest. Fetches the manifest from the relay service. */
export async function handleManifestRequest(
  message: ManifestRequest,
  relay: SyncRelayService,
): Promise<ManifestResponse> {
  const manifest = await relay.getManifest(message.systemId);
  return {
    type: "ManifestResponse",
    correlationId: message.correlationId,
    manifest,
  };
}

// ── Subscribe / Unsubscribe ─────────────────────────────────────────

/** Handle a SubscribeRequest. Registers subscriptions and computes catch-up. */
export async function handleSubscribeRequest(
  message: SubscribeRequest,
  state: SyncConnectionState,
  manager: ConnectionManager,
  relay: SyncRelayService,
): Promise<SubscribeResponse> {
  const catchup = [];

  for (const entry of message.documents) {
    if (!manager.addSubscription(state.connectionId, entry.docId)) {
      // Subscription cap reached — skip this document silently
      continue;
    }

    const [changes, snapshot] = await Promise.all([
      relay.getEnvelopesSince(entry.docId, entry.lastSyncedSeq),
      relay.getLatestSnapshot(entry.docId),
    ]);
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
export async function handleFetchSnapshot(
  message: FetchSnapshotRequest,
  relay: SyncRelayService,
): Promise<SnapshotResponse> {
  return {
    type: "SnapshotResponse",
    correlationId: message.correlationId,
    docId: message.docId,
    snapshot: await relay.getLatestSnapshot(message.docId),
  };
}

/** Handle a FetchChangesRequest. */
export async function handleFetchChanges(
  message: FetchChangesRequest,
  relay: SyncRelayService,
): Promise<ChangesResponse> {
  return {
    type: "ChangesResponse",
    correlationId: message.correlationId,
    docId: message.docId,
    changes: await relay.getEnvelopesSince(message.docId, message.sinceSeq),
  };
}

// ── Submit ──────────────────────────────────────────────────────────

/** Result of handling a SubmitChangeRequest, including the sequenced envelope for broadcast. */
export interface SubmitChangeResult {
  readonly response: ChangeAccepted;
  readonly sequencedEnvelope: EncryptedChangeEnvelope;
}

/** Handle a SubmitChangeRequest. Returns ChangeAccepted and the sequenced envelope. */
export async function handleSubmitChange(
  message: SubmitChangeRequest,
  relay: SyncRelayService,
): Promise<SubmitChangeResult> {
  const assignedSeq = await relay.submit({
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
export async function handleSubmitSnapshot(
  message: SubmitSnapshotRequest,
  relay: SyncRelayService,
): Promise<SnapshotAccepted | SyncError> {
  try {
    await relay.submitSnapshot({ ...message.snapshot, documentId: message.docId });
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
export async function handleDocumentLoad(
  message: DocumentLoadRequest,
  relay: SyncRelayService,
): Promise<[SnapshotResponse, ChangesResponse]> {
  const snapshot = await relay.getLatestSnapshot(message.docId);
  const sinceSeq = 0;
  const changes = await relay.getEnvelopesSince(message.docId, sinceSeq);

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
