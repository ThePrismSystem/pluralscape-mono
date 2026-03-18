import { blobMetadata } from "@pluralscape/db/pg";
import { and, eq, inArray, lt } from "drizzle-orm";

import { logger } from "../lib/logger.js";

import { BLOB_S3_CLEANUP_BATCH_SIZE, BLOB_S3_CLEANUP_GRACE_PERIOD_MS } from "./jobs.constants.js";

import type { JobHandler } from "@pluralscape/queue";
import type { BlobStorageAdapter } from "@pluralscape/storage";
import type { StorageKey } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/**
 * Creates a job handler for the `blob-cleanup` job type.
 *
 * Finds blobs that have been archived for longer than the grace period,
 * deletes their S3 objects via the storage adapter, then hard-deletes
 * the metadata rows from the database.
 */
export function createBlobS3CleanupHandler(
  db: PostgresJsDatabase,
  storageAdapter: BlobStorageAdapter,
): JobHandler<"blob-cleanup"> {
  return async (_job, ctx) => {
    if (ctx.signal.aborted) return;

    const cutoff = Date.now() - BLOB_S3_CLEANUP_GRACE_PERIOD_MS;

    // Find archived blobs past the grace period
    const rows = await db
      .select({ id: blobMetadata.id, storageKey: blobMetadata.storageKey })
      .from(blobMetadata)
      .where(and(eq(blobMetadata.archived, true), lt(blobMetadata.archivedAt, cutoff)))
      .limit(BLOB_S3_CLEANUP_BATCH_SIZE);

    if (rows.length === 0) return;

    // Delete S3 objects — skip individual failures so one poison blob
    // doesn't block the entire batch. Failed rows keep their metadata
    // and will be retried on the next run.
    const deletedIds: string[] = [];
    for (const row of rows) {
      try {
        await storageAdapter.delete(row.storageKey as StorageKey);
        deletedIds.push(row.id);
      } catch (error) {
        // Skip and continue — the blob metadata stays and will be retried next run
        logger.warn("Failed to delete S3 object for blob", {
          blobId: row.id,
          error: error instanceof Error ? error.message : "unknown error",
        });
      }
      await ctx.heartbeat.heartbeat();
    }

    // Hard-delete metadata rows for successfully purged blobs
    if (deletedIds.length > 0) {
      await db.delete(blobMetadata).where(inArray(blobMetadata.id, deletedIds));
    }
  };
}
