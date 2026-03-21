/**
 * Offline queue replay.
 *
 * Drains unsynced entries from the offline queue, groups them by document,
 * and re-submits them in enqueued_at order. Server-side dedup
 * (sync_changes_dedup_idx) makes re-submission safe.
 */
import { mapConcurrent } from "./map-concurrent.js";
import {
  BACKOFF_BASE_MS,
  JITTER_MAX,
  JITTER_MIN,
  MAX_RETRIES_PER_ENTRY,
  REPLAY_DOCUMENT_CONCURRENCY,
} from "./sync.constants.js";

import type { SyncNetworkAdapter } from "./adapters/network-adapter.js";
import type { OfflineQueueAdapter, OfflineQueueEntry } from "./adapters/offline-queue-adapter.js";
import type { SyncStorageAdapter } from "./adapters/storage-adapter.js";

/** Result of a replay attempt. */
export interface ReplayResult {
  readonly replayed: number;
  readonly failed: number;
  readonly skipped: number;
}

/** Configuration for offline queue replay. */
export interface ReplayOfflineQueueConfig {
  readonly offlineQueueAdapter: OfflineQueueAdapter;
  readonly networkAdapter: SyncNetworkAdapter;
  readonly storageAdapter: SyncStorageAdapter;
  readonly onError: (message: string, error: unknown) => void;
}

/**
 * Replay all unsynced offline queue entries.
 *
 * Groups entries by documentId, then processes documents concurrently
 * (bounded by REPLAY_DOCUMENT_CONCURRENCY). Within each document,
 * entries are replayed serially to preserve causal ordering.
 * Uses exponential backoff with jitter on failures, max 3 retries per entry.
 */
export async function replayOfflineQueue(config: ReplayOfflineQueueConfig): Promise<ReplayResult> {
  const entries = await config.offlineQueueAdapter.drainUnsynced();
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
  const settled = await mapConcurrent(documentGroups, REPLAY_DOCUMENT_CONCURRENCY, (docEntries) =>
    replayDocument(config, docEntries),
  );

  // Aggregate results
  let replayed = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < settled.length; i++) {
    const result = settled[i];
    if (!result) continue;
    if (result.status === "fulfilled") {
      replayed += result.value.replayed;
      failed += result.value.failed;
      skipped += result.value.skipped;
    } else {
      // Treat all entries in the failed group as failed
      const group = documentGroups[i];
      if (group) failed += group.length;
      config.onError("Document replay failed unexpectedly", result.reason);
    }
  }

  return { replayed, failed, skipped };
}

/** Replay all entries for a single document in causal order. */
async function replayDocument(
  config: ReplayOfflineQueueConfig,
  docEntries: OfflineQueueEntry[],
): Promise<ReplayResult> {
  // Sort by enqueuedAt (should already be sorted, but ensure)
  docEntries.sort((a, b) => a.enqueuedAt - b.enqueuedAt);

  let replayed = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < docEntries.length; i++) {
    const entry = docEntries[i] as OfflineQueueEntry;
    const success = await replayEntry(config, entry);
    if (success) {
      replayed++;
    } else {
      failed++;
      // Skip remaining entries for this document (causal dependency)
      const remaining = docEntries.length - i - 1;
      if (remaining > 0) {
        skipped += remaining;
        config.onError(
          `Skipping ${String(remaining)} causally-dependent entries for document ${entry.documentId} after entry ${entry.id} failed`,
          null,
        );
      }
      break;
    }
  }

  return { replayed, failed, skipped };
}

async function replayEntry(
  config: ReplayOfflineQueueConfig,
  entry: OfflineQueueEntry,
): Promise<boolean> {
  for (let attempt = 0; attempt < MAX_RETRIES_PER_ENTRY; attempt++) {
    try {
      const sequenced = await config.networkAdapter.submitChange(entry.documentId, entry.envelope);

      // Persist locally and mark synced
      await config.storageAdapter.appendChange(entry.documentId, sequenced);
      await config.offlineQueueAdapter.markSynced(entry.id, sequenced.seq);

      return true;
    } catch (error) {
      // Non-retriable errors (4xx except 408/429) fail immediately
      if (!isRetriableError(error)) {
        config.onError(
          `Replay permanently failed for entry ${entry.id}: non-retriable error`,
          error,
        );
        return false;
      }

      config.onError(
        `Replay failed for entry ${entry.id} (attempt ${String(attempt + 1)}/${String(MAX_RETRIES_PER_ENTRY)})`,
        error,
      );

      if (attempt < MAX_RETRIES_PER_ENTRY - 1) {
        // Exponential backoff with jitter
        const jitter = JITTER_MIN + Math.random() * (JITTER_MAX - JITTER_MIN);
        const delay = BACKOFF_BASE_MS * 2 ** attempt * jitter;
        await sleep(delay);
      }
    }
  }

  return false;
}

/** Lowest HTTP status code in the client-error range. */
const HTTP_CLIENT_ERROR_MIN = 400;

/** Lowest HTTP status code in the server-error range (end of client range). */
const HTTP_SERVER_ERROR_MIN = 500;

/** HTTP 408 Request Timeout — retriable despite being a 4xx. */
const HTTP_REQUEST_TIMEOUT = 408;

/** HTTP 429 Too Many Requests — retriable despite being a 4xx. */
const HTTP_TOO_MANY_REQUESTS = 429;

function isRetriableError(error: unknown): boolean {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status: number }).status;
    // 4xx errors are generally not retriable, except timeouts and rate limiting
    if (
      status >= HTTP_CLIENT_ERROR_MIN &&
      status < HTTP_SERVER_ERROR_MIN &&
      status !== HTTP_REQUEST_TIMEOUT &&
      status !== HTTP_TOO_MANY_REQUESTS
    ) {
      return false;
    }
  }
  return true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
