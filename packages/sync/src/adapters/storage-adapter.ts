import type { EncryptedChangeEnvelope, EncryptedSnapshotEnvelope } from "../types.js";

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
  loadSnapshot(documentId: string): Promise<EncryptedSnapshotEnvelope | null>;

  /**
   * Persists an encrypted snapshot for a document.
   * Must overwrite any existing snapshot — only the latest is retained.
   */
  saveSnapshot(documentId: string, snapshot: EncryptedSnapshotEnvelope): Promise<void>;

  /**
   * Loads all encrypted change envelopes since a given sequence number (exclusive).
   * Returns envelopes in ascending seq order. Returns an empty array if none exist.
   */
  loadChangesSince(
    documentId: string,
    sinceSeq: number,
  ): Promise<readonly EncryptedChangeEnvelope[]>;

  /**
   * Persists an encrypted change envelope.
   * The envelope must include a valid seq number (assigned by the relay/server).
   */
  appendChange(documentId: string, change: EncryptedChangeEnvelope): Promise<void>;

  /**
   * Removes all change envelopes for a document with seq ≤ the snapshot's
   * snapshotVersion. Called after successfully saving a snapshot to reclaim
   * storage space (the snapshot supersedes the individual changes).
   */
  pruneChangesBeforeSnapshot(documentId: string, snapshotVersion: number): Promise<void>;

  /**
   * Returns the document IDs of all documents stored locally.
   * Used to enumerate known documents during initial sync.
   */
  listDocuments(): Promise<readonly string[]>;

  /**
   * Removes all local data (snapshot + changes) for a document.
   * Called when a document is removed from the manifest and no longer needed.
   */
  deleteDocument(documentId: string): Promise<void>;
}
