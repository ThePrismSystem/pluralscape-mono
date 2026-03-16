/**
 * Injectable interface for querying orphaned blobs from the database.
 *
 * An orphaned blob is one that exists in blob_metadata but is not
 * referenced by any entity table (members, journal_entries, chat_messages, etc.)
 * past a configurable grace period.
 */
export interface OrphanBlobQuery {
  /**
   * Finds blob storage keys that are unreferenced by any entity table
   * and whose uploadedAt is older than `olderThanMs` milliseconds ago.
   */
  findOrphanedKeys(systemId: string, olderThanMs: number): Promise<readonly string[]>;
}

/** Configuration for orphan detection. */
export interface OrphanDetectorConfig {
  /** Grace period in milliseconds before an unreferenced blob is considered orphaned. */
  readonly gracePeriodMs: number;
}

const HOURS_24_MS = 86_400_000;

/** Default grace period: 24 hours. */
export const DEFAULT_GRACE_PERIOD_MS = HOURS_24_MS;

/**
 * Detects orphaned blobs that can be safely cleaned up.
 *
 * A blob is considered orphaned when:
 * 1. It exists in blob_metadata
 * 2. No entity table references it (members.avatar_blob_id, etc.)
 * 3. Its uploadedAt is older than the grace period
 */
export class OrphanBlobDetector {
  private readonly orphanQuery: OrphanBlobQuery;
  private readonly gracePeriodMs: number;

  constructor(orphanQuery: OrphanBlobQuery, config?: Partial<OrphanDetectorConfig>) {
    this.orphanQuery = orphanQuery;
    this.gracePeriodMs = config?.gracePeriodMs ?? DEFAULT_GRACE_PERIOD_MS;
  }

  /** Finds orphaned blob storage keys for a system. */
  async findOrphans(systemId: string): Promise<readonly string[]> {
    return this.orphanQuery.findOrphanedKeys(systemId, this.gracePeriodMs);
  }
}
