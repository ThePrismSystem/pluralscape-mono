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

/** Input for the compaction handler. */
export interface CompactionInput {
  readonly documentId: string;
  readonly session: EncryptedSyncSession<unknown>;
  readonly changesSinceSnapshot: number;
  readonly currentSizeBytes: number;
  readonly currentSnapshotVersion: number;
  readonly config?: CompactionConfig;
  readonly budget?: StorageBudget;
  /** All document sizes for budget check. */
  readonly allDocumentSizes?: ReadonlyMap<string, number>;
}

/** Result of a compaction attempt. */
export interface CompactionResult {
  readonly compacted: boolean;
  readonly reason: string;
  readonly newSnapshotVersion?: number;
}

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

  // 5. Save locally
  await storageAdapter.saveSnapshot(documentId, snapshotEnvelope);

  // 6. Prune old changes
  await storageAdapter.pruneChangesBeforeSnapshot(documentId, newVersion);

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
