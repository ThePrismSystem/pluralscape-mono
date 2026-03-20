/**
 * Conflict persistence adapter interface.
 *
 * Provides a way to persist auto-resolved conflict notifications to a
 * database for auditing and debugging purposes.
 */
import type { ConflictNotification, ConflictResolutionStrategy } from "./types.js";

/** A persisted conflict record. */
export interface PersistedConflict {
  readonly id: string;
  readonly documentId: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly fieldName: string | null;
  readonly resolution: ConflictResolutionStrategy;
  readonly detectedAt: number;
  readonly summary: string;
  readonly createdAt: number;
}

/**
 * Adapter for persisting auto-resolved sync conflict records.
 *
 * Implementations should be lightweight and non-blocking — conflict
 * persistence is best-effort and should not slow down the sync path.
 */
export interface ConflictPersistenceAdapter {
  /**
   * Save a batch of conflict notifications for a given document.
   * Implementations should be idempotent (safe to call multiple times
   * with the same notifications).
   */
  saveConflicts(documentId: string, notifications: readonly ConflictNotification[]): Promise<void>;

  /**
   * Delete conflict records older than the given cutoff timestamp.
   * Returns the number of records deleted.
   */
  deleteOlderThan(cutoffMs: number): Promise<number>;
}
