/**
 * WebSocket protocol message handlers.
 *
 * All handlers for the authenticated phase of the sync protocol, consolidated
 * into a single module for import simplicity.
 */
import { getSodium, InvalidInputError } from "@pluralscape/crypto";
import { authKeys } from "@pluralscape/db/pg";
import {
  EnvelopeLimitExceededError,
  SnapshotSizeLimitExceededError,
  SnapshotVersionConflictError,
  verifyEnvelopeSignature,
} from "@pluralscape/sync";
import { eq } from "drizzle-orm";

import { withAccountRead } from "../lib/rls-context.js";

import { WS_ENVELOPE_PAGE_SIZE, WS_SUBSCRIBE_CONCURRENCY } from "./ws.constants.js";

import type { ConnectionManager } from "./connection-manager.js";
import type { SyncConnectionState } from "./connection-state.js";
import type { AppLogger } from "../lib/logger.js";
import type { AeadNonce, SignPublicKey, Signature } from "@pluralscape/crypto";
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
import type { AccountId, SyncDocumentId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

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

/** Result of handling a SubscribeRequest, including skipped docs for quota reporting. */
export interface SubscribeResult {
  readonly response: SubscribeResponse;
  readonly skippedDocIds: readonly SyncDocumentId[];
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
  const droppedDocIds: SyncDocumentId[] = [];
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
        } catch (err: unknown) {
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

// ── Shared verification helpers ────────────────────────────────────

/**
 * Verify an envelope signature and return a SyncError on failure, or null on success.
 * Shared by both change and snapshot submission handlers.
 *
 * Server-side Ed25519 verification is unconditional — there is no kill-switch.
 */
export function verifyEnvelopeOrError(
  envelope: {
    authorPublicKey: SignPublicKey;
    nonce: AeadNonce;
    signature: Signature;
    ciphertext: Uint8Array;
  },
  correlationId: string | null,
  docId: SyncDocumentId,
): SyncError | null {
  try {
    const sodium = getSodium();
    const valid = verifyEnvelopeSignature({ ...envelope, documentId: docId, seq: 0 }, sodium);
    if (!valid) {
      return {
        type: "SyncError",
        correlationId,
        code: "INVALID_ENVELOPE",
        message: "Envelope signature verification failed",
        docId,
      };
    }
  } catch (err: unknown) {
    if (err instanceof InvalidInputError) {
      return {
        type: "SyncError",
        correlationId,
        code: "INVALID_ENVELOPE",
        message: "Envelope signature verification failed",
        docId,
      };
    }
    throw err;
  }
  return null;
}

/**
 * Verify that the given authorPublicKey belongs to the authenticated account.
 * Queries the auth_keys table to find a matching signing key.
 */
export async function verifyKeyOwnership(
  db: PostgresJsDatabase,
  accountId: AccountId,
  authorPublicKey: Uint8Array,
  correlationId: string | null,
  docId: SyncDocumentId,
): Promise<SyncError | null> {
  const rows = await withAccountRead(db, accountId, (tx) =>
    tx
      .select({ publicKey: authKeys.publicKey })
      .from(authKeys)
      .where(eq(authKeys.accountId, accountId)),
  );

  const keyBytes =
    authorPublicKey instanceof Uint8Array ? authorPublicKey : new Uint8Array(authorPublicKey);

  const match = rows.some((row) => {
    const rowBytes =
      row.publicKey instanceof Uint8Array ? row.publicKey : new Uint8Array(row.publicKey);
    if (rowBytes.length !== keyBytes.length) return false;
    for (let i = 0; i < rowBytes.length; i++) {
      if (rowBytes[i] !== keyBytes[i]) return false;
    }
    return true;
  });

  if (!match) {
    return {
      type: "SyncError",
      correlationId,
      code: "UNAUTHORIZED_KEY",
      message: "Author public key does not belong to the authenticated account",
      docId,
    };
  }
  return null;
}

// ── Submit ──────────────────────────────────────────────────────────

/**
 * Handle a SubmitChangeRequest. Returns ChangeAccepted and the sequenced envelope.
 *
 * The server unconditionally verifies the envelope signature before storing/broadcasting.
 * On failure, returns a SyncError with code INVALID_ENVELOPE and the envelope is dropped.
 *
 * After signature verification, validates that the authorPublicKey belongs to the
 * authenticated account's registered signing keys.
 */
export async function handleSubmitChange(
  message: SubmitChangeRequest,
  relay: SyncRelayService,
  db: PostgresJsDatabase,
  accountId: AccountId,
): Promise<SubmitChangeResult | SyncError> {
  // Sec-M2: Server-side envelope signature verification
  const sigError = verifyEnvelopeOrError(message.change, message.correlationId, message.docId);
  if (sigError) return sigError;

  // Sec-S-H1: Verify authorPublicKey belongs to the authenticated account
  const keyError = await verifyKeyOwnership(
    db,
    accountId,
    message.change.authorPublicKey,
    message.correlationId,
    message.docId,
  );
  if (keyError) return keyError;

  let assignedSeq: number;
  try {
    assignedSeq = await relay.submit({
      ...message.change,
      documentId: message.docId,
    });
  } catch (err: unknown) {
    if (err instanceof EnvelopeLimitExceededError) {
      return {
        type: "SyncError",
        correlationId: message.correlationId,
        code: "QUOTA_EXCEEDED",
        message: "Document envelope limit exceeded; compact before submitting more changes",
        docId: message.docId,
      };
    }
    throw err;
  }

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

/**
 * Handle a SubmitSnapshotRequest. Returns SnapshotAccepted or SyncError on conflict.
 *
 * Verifies envelope signature (when enabled) and authorPublicKey ownership
 * before persisting the snapshot.
 */
export async function handleSubmitSnapshot(
  message: SubmitSnapshotRequest,
  relay: SyncRelayService,
  db: PostgresJsDatabase,
  accountId: AccountId,
): Promise<SnapshotAccepted | SyncError> {
  // Sec-S-M2: Server-side snapshot signature verification
  const sigError = verifyEnvelopeOrError(message.snapshot, message.correlationId, message.docId);
  if (sigError) return sigError;

  // Sec-S-H1: Verify authorPublicKey belongs to the authenticated account
  const keyError = await verifyKeyOwnership(
    db,
    accountId,
    message.snapshot.authorPublicKey,
    message.correlationId,
    message.docId,
  );
  if (keyError) return keyError;

  try {
    await relay.submitSnapshot({ ...message.snapshot, documentId: message.docId });
    return {
      type: "SnapshotAccepted",
      correlationId: message.correlationId,
      docId: message.docId,
      snapshotVersion: message.snapshot.snapshotVersion,
    };
  } catch (err: unknown) {
    if (err instanceof SnapshotVersionConflictError) {
      return {
        type: "SyncError",
        correlationId: message.correlationId,
        code: "VERSION_CONFLICT",
        message: "Snapshot version is not newer than current version",
        docId: message.docId,
      };
    }
    if (err instanceof SnapshotSizeLimitExceededError) {
      return {
        type: "SyncError",
        correlationId: message.correlationId,
        code: "QUOTA_EXCEEDED",
        message: "Snapshot exceeds maximum allowed size",
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
  docId: SyncDocumentId,
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
