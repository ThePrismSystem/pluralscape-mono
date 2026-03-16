import type { BlobStorageAdapter } from "../interface.js";
import type { OrphanBlobDetector } from "./orphan-detector.js";

/**
 * Injectable interface for archiving blob metadata records in the database.
 */
export interface BlobArchiver {
  /** Marks a blob metadata record as archived by storage key. */
  archiveByStorageKey(storageKey: string): Promise<void>;
}

/** Result of a cleanup run. */
export interface CleanupResult {
  readonly deletedCount: number;
  readonly storageKeys: readonly string[];
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
   */
  async cleanup(systemId: string): Promise<CleanupResult> {
    const orphanKeys = await this.detector.findOrphans(systemId);

    const deletedKeys: string[] = [];

    for (const storageKey of orphanKeys) {
      // Delete from storage (idempotent)
      await this.adapter.delete(storageKey);
      // Archive the metadata record
      await this.archiver.archiveByStorageKey(storageKey);
      deletedKeys.push(storageKey);
    }

    return {
      deletedCount: deletedKeys.length,
      storageKeys: deletedKeys,
    };
  }
}
