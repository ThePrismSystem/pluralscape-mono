import * as Automerge from "@automerge/automerge";

import { parseDocumentId } from "./document-types.js";
import { createDocument } from "./factories/document-factory.js";
import { EncryptedSyncSession } from "./sync-session.js";

import type { SyncNetworkAdapter } from "./adapters/network-adapter.js";
import type { DocumentSyncState, OnDemandLoadRequest } from "./replication-profiles.js";
import type { DocumentKeys } from "./types.js";
import type { SodiumAdapter } from "@pluralscape/crypto";
import type { SyncDocumentId } from "@pluralscape/types";

/** Result of loading a document on-demand. */
export interface OnDemandLoadResult<T> {
  readonly session: EncryptedSyncSession<T>;
  readonly syncState: DocumentSyncState;
}

/**
 * Creates an EncryptedSyncSession for a fresh (empty) document.
 * The generic parameter T is determined by the caller based on the docId prefix.
 *
 * The cast from createDocument's union return type to Automerge.Doc<T> is safe
 * because createDocument dispatches on the same documentType parsed from docId,
 * and the caller is responsible for ensuring T matches that type.
 */
function createFreshSession<T>(
  docId: SyncDocumentId,
  keys: DocumentKeys,
  sodium: SodiumAdapter,
): EncryptedSyncSession<T> {
  const parsed = parseDocumentId(docId);
  const doc = createDocument(parsed.documentType) as Automerge.Doc<T>;
  return new EncryptedSyncSession<T>({
    doc,
    keys,
    documentId: docId,
    sodium,
  });
}

/**
 * Loads a document on-demand through the network adapter.
 *
 * Flow: fetchLatestSnapshot -> fromSnapshot (or fresh doc) -> fetchChangesSince
 * -> applyEncryptedChanges -> return session + DocumentSyncState
 *
 * @typeParam T - The document schema type. Caller must ensure T matches the docId.
 */
export async function requestOnDemandDocument<T>(
  request: OnDemandLoadRequest,
  adapter: SyncNetworkAdapter,
  keys: DocumentKeys,
  sodium: SodiumAdapter,
): Promise<OnDemandLoadResult<T>> {
  const snapshot = await adapter.fetchLatestSnapshot(request.docId);

  let session: EncryptedSyncSession<T>;
  let lastSnapshotVersion: number;

  if (snapshot) {
    // fromSnapshot does not accept a lastSyncedSeq because EncryptedSnapshotEnvelope
    // has no seq field (only snapshotVersion). The session starts with lastSyncedSeq=0,
    // so fetchChangesSince below will request all changes. This is safe because
    // applyEncryptedChanges skips envelopes with seq <= lastSyncedSeq_ and Automerge's
    // applyChanges is idempotent (duplicate changes are deduped by hash). The trade-off
    // is fetching some already-applied changes, which is acceptable for on-demand loads.
    session = EncryptedSyncSession.fromSnapshot<T>(snapshot, keys, sodium);
    lastSnapshotVersion = snapshot.snapshotVersion;
  } else {
    session = createFreshSession<T>(request.docId, keys, sodium);
    lastSnapshotVersion = 0;
  }

  const changes = await adapter.fetchChangesSince(request.docId, session.lastSyncedSeq);
  if (changes.length > 0) {
    session.applyEncryptedChanges(changes);
  }

  return {
    session,
    syncState: {
      docId: request.docId,
      lastSyncedSeq: session.lastSyncedSeq,
      lastSnapshotVersion,
      onDemand: true,
    },
  };
}
