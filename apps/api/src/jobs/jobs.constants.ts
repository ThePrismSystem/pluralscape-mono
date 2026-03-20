/**
 * Job-layer constants.
 * Domain: background job handlers.
 */

import { MS_PER_DAY } from "@pluralscape/types";

/**
 * Grace period before archived blob S3 objects are permanently deleted.
 * Allows users to restore archived blobs within 30 days without data loss.
 */
export const BLOB_S3_CLEANUP_GRACE_PERIOD_MS = 30 * MS_PER_DAY;

/**
 * Maximum number of archived blobs to process per cleanup job run.
 * Keeps individual job runs bounded to avoid timeouts on large backlogs.
 */
export const BLOB_S3_CLEANUP_BATCH_SIZE = 100;

/**
 * Retention period for confirmed offline queue entries before cleanup deletes them.
 * Entries that have been successfully synced to the server are kept for 7 days
 * to allow for debugging, then permanently deleted.
 */
export const SYNC_QUEUE_RETENTION_MS = 7 * MS_PER_DAY;
