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

/** Maximum number of documents replayed concurrently. */
const REPLAY_DOCUMENT_CONCURRENCY = 3;

/** Minimum jitter multiplier applied to backoff delay. */
const JITTER_MIN = 0.5;

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
  readonly onError: (message: string, error: unknown) => void;
}

/** Per-document replay result used for aggregation. */
interface DocumentReplayResult {
  readonly replayed: number;
  readonly failed: number;
  readonly skipped: number;
}

/**
 * Manages offline queue replay.
 *
 * Called at the end of SyncEngine.bootstrap() and exposed as
 * engine.replayOfflineQueue() for manual triggering.
 */
export class OfflineQueueManager {
  private readonly config: OfflineQueueManagerConfig;

  constructor(config: OfflineQueueManagerConfig) {
    this.config = config;
  }

  /**
   * Replay all unsynced entries.
   *
   * Groups entries by documentId, then processes documents concurrently
   * (bounded by REPLAY_DOCUMENT_CONCURRENCY). Within each document,
   * entries are replayed serially to preserve causal ordering.
   * Uses exponential backoff with jitter on failures, max 3 retries per entry.
   */
  async replay(): Promise<ReplayResult> {
    const entries = await this.config.offlineQueueAdapter.drainUnsynced();
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

    // Process documents concurrently with bounded parallelism
    const documentGroups = [...byDocument.values()];
    const docResults = await mapConcurrentReplay(
      documentGroups,
      REPLAY_DOCUMENT_CONCURRENCY,
      (docEntries) => this.replayDocument(docEntries),
    );

    // Aggregate results
    let replayed = 0;
    let failed = 0;
    let skipped = 0;

    for (const docResult of docResults) {
      replayed += docResult.replayed;
      failed += docResult.failed;
      skipped += docResult.skipped;
    }

    return { replayed, failed, skipped };
  }

  /** Replay all entries for a single document in causal order. */
  private async replayDocument(docEntries: OfflineQueueEntry[]): Promise<DocumentReplayResult> {
    // Sort by enqueuedAt (should already be sorted, but ensure)
    docEntries.sort((a, b) => a.enqueuedAt - b.enqueuedAt);

    let replayed = 0;
    let failed = 0;
    let skipped = 0;

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

    return { replayed, failed, skipped };
  }

  private async replayEntry(entry: OfflineQueueEntry): Promise<boolean> {
    for (let attempt = 0; attempt < MAX_RETRIES_PER_ENTRY; attempt++) {
      try {
        const sequenced = await this.config.networkAdapter.submitChange(
          entry.documentId,
          entry.envelope,
        );

        // Persist locally and mark synced
        await this.config.storageAdapter.appendChange(entry.documentId, sequenced);
        await this.config.offlineQueueAdapter.markSynced(entry.id, sequenced.seq);

        return true;
      } catch (error) {
        this.config.onError(
          `Replay failed for entry ${entry.id} (attempt ${String(attempt + 1)}/${String(MAX_RETRIES_PER_ENTRY)})`,
          error,
        );

        if (attempt < MAX_RETRIES_PER_ENTRY - 1) {
          // Exponential backoff with jitter
          const jitter = JITTER_MIN + Math.random() * JITTER_MIN;
          const delay = BACKOFF_BASE_MS * 2 ** attempt * jitter;
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

/**
 * Runs `fn` over `items` with bounded concurrency, returning results in order.
 * Safe in single-threaded JS: `index++` is atomic within a synchronous tick.
 */
async function mapConcurrentReplay<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = Array.from<R | undefined>({ length: items.length });
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const i = index++;
      const item = items[i] as T;
      results[i] = await fn(item);
    }
  }

  const workers: Promise<void>[] = [];
  for (let i = 0; i < Math.min(limit, items.length); i++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results as R[];
}
