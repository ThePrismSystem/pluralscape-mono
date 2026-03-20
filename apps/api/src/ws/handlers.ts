/**
 * WebSocket protocol message handlers.
 *
 * All handlers for the authenticated phase of the sync protocol, consolidated
 * into a single module for import simplicity.
 */
import { SnapshotVersionConflictError } from "@pluralscape/sync";

import { WS_SUBSCRIBE_CONCURRENCY } from "./ws.constants.js";

import type { ConnectionManager } from "./connection-manager.js";
import type { SyncConnectionState } from "./connection-state.js";
import type { AppLogger } from "../lib/logger.js";
import type {
  ChangeAccepted,
  ChangesResponse,
  DocumentCatchup,
  DocumentLoadRequest,
  DocumentVersionEntry,
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
import type { SystemId } from "@pluralscape/types";

// ── Manifest ────────────────────────────────────────────────────────

/** Handle a ManifestRequest. Fetches the manifest from the relay service. */
export async function handleManifestRequest(
  message: ManifestRequest,
  relay: SyncRelayService,
): Promise<ManifestResponse> {
  // Safe cast: router validates message.systemId === state.systemId before dispatch
  const manifest = await relay.getManifest(message.systemId as SystemId);
  return {
    type: "ManifestResponse",
    correlationId: message.correlationId,
    manifest,
  };
}

// ── Subscribe / Unsubscribe ─────────────────────────────────────────

/** Result of handling a SubscribeRequest, including skipped docs for quota reporting. */
export interface SubscribeResult {
  readonly response: SubscribeResponse;
  readonly skippedDocIds: readonly string[];
}

/** Handle a SubscribeRequest. Registers subscriptions and computes catch-up. */
export async function handleSubscribeRequest(
  message: SubscribeRequest,
  state: SyncConnectionState,
  manager: ConnectionManager,
  relay: SyncRelayService,
  log: AppLogger,
): Promise<SubscribeResponse> {
  // Phase 1: register subscriptions, partition into permitted vs dropped
  const droppedDocIds: string[] = [];
  const permitted: DocumentVersionEntry[] = [];

  for (const entry of message.documents) {
    if (!manager.addSubscription(state.connectionId, entry.docId)) {
      droppedDocIds.push(entry.docId);
      log.warn("Subscription cap reached, dropping document", {
        connectionId: state.connectionId,
        docId: entry.docId,
      });
      continue;
    }
    permitted.push(entry);
  }

  // Phase 2: fetch catchup data with bounded concurrency
  const catchupResults: (DocumentCatchup | null)[] = [];

  for (let i = 0; i < permitted.length; i += WS_SUBSCRIBE_CONCURRENCY) {
    const batch = permitted.slice(i, i + WS_SUBSCRIBE_CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (entry): Promise<DocumentCatchup | null> => {
        const [changes, snapshot] = await Promise.all([
          relay.getEnvelopesSince(entry.docId, entry.lastSyncedSeq),
          relay.getLatestSnapshot(entry.docId),
        ]);
        const hasNewerSnapshot =
          snapshot !== null && snapshot.snapshotVersion > entry.lastSnapshotVersion;

        if (changes.length > 0 || hasNewerSnapshot) {
          return {
            docId: entry.docId,
            changes,
            snapshot: hasNewerSnapshot ? snapshot : null,
          };
        }
        return null;
      }),
    );
    catchupResults.push(...batchResults);
  }

  const catchup = catchupResults.filter((c): c is DocumentCatchup => c !== null);

  return {
    type: "SubscribeResponse",
    correlationId: message.correlationId,
    catchup,
    droppedDocIds,
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
    if (err instanceof SnapshotVersionConflictError) {
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
  const [snapshot, changes] = await Promise.all([
    relay.getLatestSnapshot(message.docId),
    relay.getEnvelopesSince(message.docId, 0),
  ]);

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
