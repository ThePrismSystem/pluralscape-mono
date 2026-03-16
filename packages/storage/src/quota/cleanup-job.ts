import type { BlobStorageAdapter } from "../interface.js";
import type { OrphanBlobDetector } from "./orphan-detector.js";
import type { StorageKey, SystemId } from "@pluralscape/types";

/**
 * Injectable interface for archiving blob metadata records in the database.
 *
 * Implementations MUST be idempotent — archiving an already-archived record
 * should succeed without error.
 */
export interface BlobArchiver {
  /** Marks a blob metadata record as archived by storage key. */
  archiveByStorageKey(storageKey: StorageKey): Promise<void>;
}

/** Result of a cleanup run. */
export interface CleanupResult {
  readonly deletedCount: number;
  readonly storageKeys: readonly StorageKey[];
  readonly failedCount: number;
  readonly failedKeys: readonly StorageKey[];
}

/**
 * Handles blob orphan cleanup.
 *
 * Designed to be called from a job handler registered with the queue system.
 * Finds orphaned blobs, deletes them from storage, and archives metadata records.
 *
 * This is NOT a JobHandler itself — it's the business logic that a JobHandler calls.
 * The job handler registration happens at the API layer where the queue is configured.
 */
export class BlobCleanupHandler {
  private readonly adapter: BlobStorageAdapter;
  private readonly detector: OrphanBlobDetector;
  private readonly archiver: BlobArchiver;

  constructor(adapter: BlobStorageAdapter, detector: OrphanBlobDetector, archiver: BlobArchiver) {
    this.adapter = adapter;
    this.detector = detector;
    this.archiver = archiver;
  }

  /**
   * Runs cleanup for a system: finds orphans, deletes from storage, archives metadata.
   * Idempotent — re-running on already-cleaned blobs is safe.
   *
   * Per-key errors are isolated: a failure on one key does not abort remaining keys.
   * Detector failures (e.g., DB unavailable) propagate immediately.
   */
  async cleanup(systemId: SystemId): Promise<CleanupResult> {
    const orphanKeys = await this.detector.findOrphans(systemId);

    const deletedKeys: StorageKey[] = [];
    const failedKeys: StorageKey[] = [];

    for (const storageKey of orphanKeys) {
      try {
        await this.adapter.delete(storageKey);
        await this.archiver.archiveByStorageKey(storageKey);
        deletedKeys.push(storageKey);
      } catch {
        failedKeys.push(storageKey);
      }
    }

    return {
      deletedCount: deletedKeys.length,
      storageKeys: deletedKeys,
      failedCount: failedKeys.length,
      failedKeys,
    };
  }
}
