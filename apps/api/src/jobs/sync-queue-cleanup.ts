/**
 * Sync queue cleanup job handler.
 *
 * Deletes offline queue entries that have been synced for longer than
 * the configured retention period, and optionally cleans up old conflict records.
 */
import { SYNC_CONFLICTS_RETENTION_MS, SYNC_QUEUE_RETENTION_MS } from "./jobs.constants.js";

import type { JobHandler } from "@pluralscape/queue";
import type { ConflictPersistenceAdapter, OfflineQueueAdapter } from "@pluralscape/sync";

/**
 * Creates a job handler for the `sync-queue-cleanup` job type.
 *
 * Deletes confirmed offline queue entries older than the retention period
 * to reclaim local storage space. Optionally cleans up old conflict records.
 */
export function createSyncQueueCleanupHandler(
  offlineQueueAdapter: OfflineQueueAdapter,
  conflictPersistenceAdapter?: ConflictPersistenceAdapter,
): JobHandler<"sync-queue-cleanup"> {
  return async (_job, ctx) => {
    if (ctx.signal.aborted) return;
    const cutoff = Date.now() - SYNC_QUEUE_RETENTION_MS;
    await offlineQueueAdapter.deleteConfirmed(cutoff);

    if (conflictPersistenceAdapter) {
      const conflictCutoff = Date.now() - SYNC_CONFLICTS_RETENTION_MS;
      await conflictPersistenceAdapter.deleteOlderThan(conflictCutoff);
    }
  };
}
