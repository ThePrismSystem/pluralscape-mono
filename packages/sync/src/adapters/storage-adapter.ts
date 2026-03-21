import type { EncryptedChangeEnvelope, EncryptedSnapshotEnvelope } from "../types.js";
import type { SyncDocumentId } from "@pluralscape/types";

/**
 * Persistence interface for encrypted CRDT sync data.
 *
 * Implementations must store and retrieve encrypted change envelopes and
 * snapshots for offline-first operation. The adapter never sees plaintext —
 * it stores the same encrypted bytes that transit the network.
 *
 * Implementations: SQLite (primary, for local-first on device), IndexedDB (web).
 */
export interface SyncStorageAdapter {
  /**
   * Loads the latest encrypted snapshot for a document.
   * Returns null if no snapshot exists (new document or not yet snapshotted).
   */
  loadSnapshot(documentId: SyncDocumentId): Promise<EncryptedSnapshotEnvelope | null>;

  /**
   * Persists an encrypted snapshot for a document.
   * Must overwrite any existing snapshot — only the latest is retained.
   */
  saveSnapshot(documentId: SyncDocumentId, snapshot: EncryptedSnapshotEnvelope): Promise<void>;

  /**
   * Loads all encrypted change envelopes since a given sequence number (exclusive).
   * Returns envelopes in ascending seq order. Returns an empty array if none exist.
   */
  loadChangesSince(
    documentId: SyncDocumentId,
    sinceSeq: number,
  ): Promise<readonly EncryptedChangeEnvelope[]>;

  /**
   * Persists an encrypted change envelope.
   * The envelope must include a valid seq number (assigned by the relay/server).
   */
  appendChange(documentId: SyncDocumentId, change: EncryptedChangeEnvelope): Promise<void>;

  /**
   * Persists multiple encrypted change envelopes in a single batch.
   * Optional — callers should fall back to individual `appendChange` calls
   * when this method is not implemented.
   */
  appendChanges?(
    documentId: SyncDocumentId,
    changes: readonly EncryptedChangeEnvelope[],
  ): Promise<void>;

  /**
   * Removes all change envelopes for a document with seq ≤ the snapshot's
   * snapshotVersion. Called after successfully saving a snapshot to reclaim
   * storage space (the snapshot supersedes the individual changes).
   */
  pruneChangesBeforeSnapshot(documentId: SyncDocumentId, snapshotVersion: number): Promise<void>;

  /**
   * Returns the document IDs of all documents stored locally.
   * Used to enumerate known documents during initial sync.
   */
  listDocuments(): Promise<readonly SyncDocumentId[]>;

  /**
   * Removes all local data (snapshot + changes) for a document.
   * Called when a document is removed from the manifest and no longer needed.
   */
  deleteDocument(documentId: SyncDocumentId): Promise<void>;

  /**
   * Releases any resources held by the adapter (e.g. database connections).
   * Optional — not all adapters require explicit cleanup.
   */
  close?(): void | Promise<void>;
}
