/**
 * WebSocket protocol message handlers.
 *
 * All handlers for the authenticated phase of the sync protocol, consolidated
 * into a single module for import simplicity.
 */
import { getSodium, InvalidInputError } from "@pluralscape/crypto";
import { SnapshotVersionConflictError, verifyEnvelopeSignature } from "@pluralscape/sync";

import { WS_ENVELOPE_PAGE_SIZE, WS_SUBSCRIBE_CONCURRENCY } from "./ws.constants.js";

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
        try {
          const [changes, snapshot] = await Promise.all([
            collectAllEnvelopes(relay, entry.docId, entry.lastSyncedSeq, WS_ENVELOPE_PAGE_SIZE),
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
        } catch (err) {
          log.error("Failed to fetch catchup for document", {
            docId: entry.docId,
            error: err instanceof Error ? err.message : String(err),
          });
          droppedDocIds.push(entry.docId);
          manager.removeSubscription(state.connectionId, entry.docId);
          return null;
        }
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
  const changes = await collectAllEnvelopes(
    relay,
    message.docId,
    message.sinceSeq,
    WS_ENVELOPE_PAGE_SIZE,
  );
  return {
    type: "ChangesResponse",
    correlationId: message.correlationId,
    docId: message.docId,
    changes,
  };
}

// ── Submit ──────────────────────────────────────────────────────────

/** Result of handling a SubmitChangeRequest, including the sequenced envelope for broadcast. */
export interface SubmitChangeResult {
  readonly type: "SubmitChangeResult";
  readonly response: ChangeAccepted;
  readonly sequencedEnvelope: EncryptedChangeEnvelope;
}

/**
 * Handle a SubmitChangeRequest. Returns ChangeAccepted and the sequenced envelope.
 *
 * When envelope signature verification is enabled (VERIFY_ENVELOPE_SIGNATURES env var),
 * the server verifies the envelope signature before storing/broadcasting. On failure,
 * returns a SyncError with code INVALID_ENVELOPE and the envelope is dropped.
 */
export async function handleSubmitChange(
  message: SubmitChangeRequest,
  relay: SyncRelayService,
): Promise<SubmitChangeResult | SyncError> {
  // Sec-M2: Server-side envelope signature verification
  if (shouldVerifyEnvelopeSignatures()) {
    let valid: boolean;
    try {
      const sodium = getSodium();
      valid = verifyEnvelopeSignature(
        { ...message.change, documentId: message.docId, seq: 0 },
        sodium,
      );
    } catch (err) {
      if (err instanceof InvalidInputError) {
        return {
          type: "SyncError",
          correlationId: message.correlationId,
          code: "INVALID_ENVELOPE",
          message: "Envelope signature verification failed",
          docId: message.docId,
        };
      }
      throw err;
    }
    if (!valid) {
      return {
        type: "SyncError",
        correlationId: message.correlationId,
        code: "INVALID_ENVELOPE",
        message: "Envelope signature verification failed",
        docId: message.docId,
      };
    }
  }

  const assignedSeq = await relay.submit({
    ...message.change,
    documentId: message.docId,
  });

  return {
    type: "SubmitChangeResult",
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
 * P-H2: Optimized to fetch changes since the latest snapshot version rather
 * than from seq 0. If a snapshot exists, only changes after snapshotVersion
 * are fetched. If no snapshot exists, falls back to paginated fetch from seq 0.
 */
export async function handleDocumentLoad(
  message: DocumentLoadRequest,
  relay: SyncRelayService,
): Promise<[SnapshotResponse, ChangesResponse]> {
  const snapshot = await relay.getLatestSnapshot(message.docId);

  // Fetch changes since the snapshot version (or from seq 0 if no snapshot)
  const sinceSeq = snapshot !== null ? snapshot.snapshotVersion : 0;
  const changes = await collectAllEnvelopes(relay, message.docId, sinceSeq, WS_ENVELOPE_PAGE_SIZE);

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

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Fetch all envelopes by looping through pages until `hasMore` is false.
 * Prevents silent truncation when a document exceeds a single page of results.
 */
async function collectAllEnvelopes(
  relay: SyncRelayService,
  docId: string,
  sinceSeq: number,
  pageSize: number,
): Promise<readonly EncryptedChangeEnvelope[]> {
  const all: EncryptedChangeEnvelope[] = [];
  let cursor = sinceSeq;
  for (;;) {
    const page = await relay.getEnvelopesSince(docId, cursor, pageSize);
    all.push(...page.envelopes);
    if (!page.hasMore || page.envelopes.length === 0) break;
    const last = page.envelopes[page.envelopes.length - 1];
    if (!last) break;
    cursor = last.seq;
  }
  return all;
}

/**
 * Whether to verify envelope signatures server-side.
 * Configurable via VERIFY_ENVELOPE_SIGNATURES env var for performance tuning.
 * Defaults to true (secure by default).
 */
function shouldVerifyEnvelopeSignatures(): boolean {
  const envVal = process.env["VERIFY_ENVELOPE_SIGNATURES"];
  if (envVal === undefined) return true;
  return envVal !== "false" && envVal !== "0";
}
