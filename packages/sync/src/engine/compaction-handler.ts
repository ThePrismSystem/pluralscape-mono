/**
 * Compaction job handler.
 *
 * Checks whether a document is eligible for compaction, creates a snapshot
 * from the current Automerge state, submits it to the relay, and prunes
 * superseded changes from local storage.
 */
import { checkCompactionEligibility } from "../compaction.js";
import { checkStorageBudget } from "../storage-budget.js";

import type { SyncStorageAdapter } from "../adapters/storage-adapter.js";
import type { SyncRelayService } from "../relay-service.js";
import type { EncryptedSyncSession } from "../sync-session.js";
import type { CompactionConfig, StorageBudget } from "../types.js";

/** Why a compaction was performed. */
export type CompactionReason = "change-threshold" | "size-threshold" | "explicit";

/** Why a compaction was skipped. */
export type CompactionSkipReason = "not-eligible" | "storage-budget-exceeded";

/** Input for the compaction handler. */
export interface CompactionInput {
  readonly documentId: string;
  readonly session: EncryptedSyncSession<unknown>;
  readonly changesSinceSnapshot: number;
  readonly currentSizeBytes: number;
  readonly currentSnapshotVersion: number;
  /** The highest change seq seen by this session. */
  readonly lastSyncedSeq: number;
  readonly config?: CompactionConfig;
  readonly budget?: StorageBudget;
  /** All document sizes for budget check. */
  readonly allDocumentSizes?: ReadonlyMap<string, number>;
}

/** Result of a compaction attempt. */
export type CompactionResult =
  | {
      readonly compacted: true;
      readonly reason: CompactionReason;
      readonly newSnapshotVersion: number;
      readonly localSaveFailed?: boolean;
    }
  | { readonly compacted: false; readonly reason: CompactionSkipReason };

/**
 * Attempt to compact a document by creating a snapshot.
 *
 * Flow:
 * 1. Check compaction eligibility (change threshold or size threshold)
 * 2. Check storage budget (abort if over budget)
 * 3. Create snapshot via session
 * 4. Submit snapshot to relay
 * 5. Save snapshot locally
 * 6. Prune changes that are now superseded by the snapshot
 */
export async function handleCompaction(
  input: CompactionInput,
  relayService: SyncRelayService,
  storageAdapter: SyncStorageAdapter,
): Promise<CompactionResult> {
  const {
    documentId,
    session,
    changesSinceSnapshot,
    currentSizeBytes,
    currentSnapshotVersion,
    lastSyncedSeq,
    config,
    budget,
    allDocumentSizes,
  } = input;

  // 1. Check eligibility
  const eligibility = checkCompactionEligibility(changesSinceSnapshot, currentSizeBytes, config);

  if (!eligibility.eligible) {
    return { compacted: false, reason: eligibility.reason };
  }

  // 2. Check storage budget (if document sizes provided)
  if (allDocumentSizes && budget) {
    const budgetStatus = checkStorageBudget(allDocumentSizes, budget);
    if (!budgetStatus.withinBudget) {
      return { compacted: false, reason: "storage-budget-exceeded" };
    }
  }

  // 3. Create snapshot with next version
  const newVersion = currentSnapshotVersion + 1;
  const snapshotEnvelope = session.createSnapshot(newVersion);

  // 4. Submit to relay
  await relayService.submitSnapshot(snapshotEnvelope);

  // 5-6. Save locally and prune — wrapped in try/catch for partial failure resilience.
  // If relay submission succeeded but local save/prune fails, the snapshot is still on
  // the server, so we still report success but flag the local failure.
  try {
    await storageAdapter.saveSnapshot(documentId, snapshotEnvelope);
    await storageAdapter.pruneChangesBeforeSnapshot(documentId, lastSyncedSeq);
  } catch (error: unknown) {
    console.warn("[CompactionHandler] local save/prune failed for", documentId, error);
    return {
      compacted: true,
      reason: eligibility.reason,
      newSnapshotVersion: newVersion,
      localSaveFailed: true,
    };
  }

  return {
    compacted: true,
    reason: eligibility.reason,
    newSnapshotVersion: newVersion,
  };
}

/** Build the idempotency key for a compaction job. */
export function compactionIdempotencyKey(documentId: string, snapshotVersion: number): string {
  return `sync-compaction:${documentId}:${String(snapshotVersion)}`;
}
