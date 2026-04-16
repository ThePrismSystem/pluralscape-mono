/**
 * Offline queue adapter interface.
 *
 * Provides a persistence layer for local changes that have not yet been
 * confirmed by the server. Entries are enqueued before server submission
 * and marked as synced once the server acknowledges them.
 */
import type { EncryptedChangeEnvelope } from "../types.js";
import type { SyncDocumentId } from "@pluralscape/types";

/** An entry in the offline queue. */
export interface OfflineQueueEntry {
  readonly id: string;
  readonly documentId: SyncDocumentId;
  readonly envelope: Omit<EncryptedChangeEnvelope, "seq">;
  readonly enqueuedAt: number;
  readonly syncedAt: number | null;
  readonly serverSeq: number | null;
}

/**
 * Persistence adapter for the offline change queue.
 *
 * Changes are enqueued locally before submission to the server. On success,
 * they are marked as synced. On failure (offline), they remain unsynced
 * for replay on reconnect.
 */
export interface OfflineQueueAdapter {
  /** Enqueue a change for later submission. Returns the entry ID. */
  enqueue(
    documentId: SyncDocumentId,
    envelope: Omit<EncryptedChangeEnvelope, "seq">,
  ): Promise<string>;

  /** Drain up to a batch of unsynced entries, ordered by enqueuedAt. */
  drainUnsynced(): Promise<readonly OfflineQueueEntry[]>;

  /** Mark an entry as synced with the server-assigned sequence number. */
  markSynced(id: string, serverSeq: number): Promise<void>;

  /** Delete confirmed entries older than cutoffMs. Returns the number deleted. */
  deleteConfirmed(cutoffMs: number): Promise<number>;

  /** Release resources. Optional. */
  close?(): void | Promise<void>;
}
