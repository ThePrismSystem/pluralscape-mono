import { parseDocumentId } from "./document-types.js";
import { createDocument } from "./factories/document-factory.js";
import { EncryptedSyncSession } from "./sync-session.js";

import type { SyncNetworkAdapter } from "./adapters/network-adapter.js";
import type { DocumentSyncState, OnDemandLoadRequest } from "./replication-profiles.js";
import type { DocumentKeys } from "./types.js";
import type { SodiumAdapter } from "@pluralscape/crypto";

/** Result of loading a document on-demand. */
export interface OnDemandLoadResult<T> {
  readonly session: EncryptedSyncSession<T>;
  readonly syncState: DocumentSyncState;
}

/**
 * Creates an EncryptedSyncSession for a fresh (empty) document.
 * The generic parameter T is determined by the caller based on the docId prefix.
 * Runtime safety: createDocument returns a typed Doc matching the docId's document type.
 */
function createFreshSession<T>(
  docId: string,
  keys: DocumentKeys,
  sodium: SodiumAdapter,
): EncryptedSyncSession<T> {
  const parsed = parseDocumentId(docId);
  const doc: unknown = createDocument(parsed.documentType);
  return new EncryptedSyncSession<T>({
    doc: doc as T,
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
