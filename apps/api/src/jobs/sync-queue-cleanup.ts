/**
 * Sync queue cleanup job handler.
 *
 * Deletes offline queue entries that have been synced for longer than
 * the configured retention period.
 */
import { SYNC_QUEUE_RETENTION_MS } from "./jobs.constants.js";

import type { JobHandler } from "@pluralscape/queue";
import type { OfflineQueueAdapter } from "@pluralscape/sync";

/**
 * Creates a job handler for the `sync-queue-cleanup` job type.
 *
 * Deletes confirmed offline queue entries older than the retention period
 * to reclaim local storage space.
 */
export function createSyncQueueCleanupHandler(
  offlineQueueAdapter: OfflineQueueAdapter,
): JobHandler<"sync-queue-cleanup"> {
  return async (_job, ctx) => {
    if (ctx.signal.aborted) return;
    const cutoff = Date.now() - SYNC_QUEUE_RETENTION_MS;
    await offlineQueueAdapter.deleteConfirmed(cutoff);
  };
}
