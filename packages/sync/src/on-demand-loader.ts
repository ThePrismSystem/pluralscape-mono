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
 * Stateful on-demand document loader.
 *
 * Tracks the highest fetched change sequence per document so that
 * repeated loads of the same document skip already-fetched changes.
 *
 * Trade-off: the map grows by one entry per loaded document. This is
 * acceptable because on-demand loads are infrequent (historical period
 * browsing) and the map is bounded by the total number of documents in
 * the system. The memory cost (one SyncDocumentId + number per entry)
 * is negligible compared to the Automerge documents themselves.
 */
export class OnDemandLoader {
  private readonly lastFetchedSeq = new Map<SyncDocumentId, number>();

  /** Get the last fetched seq for a document, or 0 if never fetched. */
  getLastFetchedSeq(docId: SyncDocumentId): number {
    return this.lastFetchedSeq.get(docId) ?? 0;
  }

  /** Load a document on-demand, using tracked seq to avoid re-fetching changes. */
  async load<T>(
    request: OnDemandLoadRequest,
    adapter: SyncNetworkAdapter,
    keys: DocumentKeys,
    sodium: SodiumAdapter,
  ): Promise<OnDemandLoadResult<T>> {
    const result = await loadOnDemandDocument<T>(
      request,
      adapter,
      keys,
      sodium,
      this.lastFetchedSeq.get(request.docId) ?? 0,
    );

    const prev = this.lastFetchedSeq.get(request.docId) ?? 0;
    this.lastFetchedSeq.set(request.docId, Math.max(prev, result.syncState.lastSyncedSeq));
    return result;
  }

  /** Clear tracked state for all documents. */
  clear(): void {
    this.lastFetchedSeq.clear();
  }
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
  return loadOnDemandDocument<T>(request, adapter, keys, sodium, 0);
}

/** @internal Shared implementation used by both the stateless function and OnDemandLoader. */
async function loadOnDemandDocument<T>(
  request: OnDemandLoadRequest,
  adapter: SyncNetworkAdapter,
  keys: DocumentKeys,
  sodium: SodiumAdapter,
  sinceSeq: number,
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

  // Use the higher of session.lastSyncedSeq and the caller-provided sinceSeq
  // to avoid re-fetching changes already applied in a previous load.
  const fetchSinceSeq = Math.max(session.lastSyncedSeq, sinceSeq);
  const changes = await adapter.fetchChangesSince(request.docId, fetchSinceSeq);
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
