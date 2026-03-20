/**
 * Offline queue replay manager.
 *
 * Drains unsynced entries from the offline queue, groups them by document,
 * and re-submits them in enqueued_at order. Server-side dedup
 * (sync_changes_dedup_idx) makes re-submission safe.
 */
import type { SyncNetworkAdapter } from "./adapters/network-adapter.js";
import type { OfflineQueueAdapter, OfflineQueueEntry } from "./adapters/offline-queue-adapter.js";
import type { SyncStorageAdapter } from "./adapters/storage-adapter.js";

/** Maximum number of retries per entry before giving up. */
const MAX_RETRIES_PER_ENTRY = 3;

/** Base delay in ms for exponential backoff. */
const BACKOFF_BASE_MS = 500;

/** Result of a replay attempt. */
export interface ReplayResult {
  readonly replayed: number;
  readonly failed: number;
  readonly skipped: number;
}

/** Configuration for the OfflineQueueManager. */
export interface OfflineQueueManagerConfig {
  readonly offlineQueueAdapter: OfflineQueueAdapter;
  readonly networkAdapter: SyncNetworkAdapter;
  readonly storageAdapter: SyncStorageAdapter;
  readonly onError?: (message: string, error: unknown) => void;
}

/**
 * Manages offline queue replay.
 *
 * Called at the end of SyncEngine.bootstrap() and exposed as
 * engine.replayOfflineQueue() for manual triggering.
 */
export class OfflineQueueManager {
  private readonly offlineQueueAdapter: OfflineQueueAdapter;
  private readonly networkAdapter: SyncNetworkAdapter;
  private readonly storageAdapter: SyncStorageAdapter;
  private readonly onError: (message: string, error: unknown) => void;

  constructor(config: OfflineQueueManagerConfig) {
    this.offlineQueueAdapter = config.offlineQueueAdapter;
    this.networkAdapter = config.networkAdapter;
    this.storageAdapter = config.storageAdapter;
    this.onError =
      config.onError ??
      ((message, error) => {
        console.error(message, error);
      });
  }

  /**
   * Replay all unsynced entries.
   *
   * Groups entries by documentId, submits in enqueued_at order.
   * Uses exponential backoff on failures, max 3 retries per entry.
   */
  async replay(): Promise<ReplayResult> {
    const entries = await this.offlineQueueAdapter.drainUnsynced();
    if (entries.length === 0) {
      return { replayed: 0, failed: 0, skipped: 0 };
    }

    // Group by documentId
    const byDocument = new Map<string, OfflineQueueEntry[]>();
    for (const entry of entries) {
      const existing = byDocument.get(entry.documentId);
      if (existing) {
        existing.push(entry);
      } else {
        byDocument.set(entry.documentId, [entry]);
      }
    }

    let replayed = 0;
    let failed = 0;
    let skipped = 0;

    // Process each document's entries in order (causal ordering)
    for (const [, docEntries] of byDocument) {
      // Sort by enqueuedAt (should already be sorted, but ensure)
      docEntries.sort((a, b) => a.enqueuedAt - b.enqueuedAt);

      for (let i = 0; i < docEntries.length; i++) {
        const entry = docEntries[i] as OfflineQueueEntry;
        const success = await this.replayEntry(entry);
        if (success) {
          replayed++;
        } else {
          failed++;
          // Skip remaining entries for this document (causal dependency)
          skipped += docEntries.length - i - 1;
          break;
        }
      }
    }

    return { replayed, failed, skipped };
  }

  private async replayEntry(entry: OfflineQueueEntry): Promise<boolean> {
    for (let attempt = 0; attempt < MAX_RETRIES_PER_ENTRY; attempt++) {
      try {
        const sequenced = await this.networkAdapter.submitChange(entry.documentId, entry.envelope);

        // Persist locally and mark synced
        await this.storageAdapter.appendChange(entry.documentId, sequenced);
        await this.offlineQueueAdapter.markSynced(entry.id, sequenced.seq);

        return true;
      } catch (error) {
        this.onError(
          `Replay failed for entry ${entry.id} (attempt ${String(attempt + 1)}/${String(MAX_RETRIES_PER_ENTRY)})`,
          error,
        );

        if (attempt < MAX_RETRIES_PER_ENTRY - 1) {
          // Exponential backoff
          const delay = BACKOFF_BASE_MS * 2 ** attempt;
          await sleep(delay);
        }
      }
    }

    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
