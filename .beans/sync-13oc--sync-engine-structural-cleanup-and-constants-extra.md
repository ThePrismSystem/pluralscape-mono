---
# sync-13oc
title: Sync engine structural cleanup and constants extraction
status: completed
type: task
created_at: 2026-03-21T03:50:47Z
updated_at: 2026-03-21T03:50:47Z
parent: ps-irrf
---

## Summary of Changes

Implements 8 findings from the M3 comprehensive audit (Q-H2, T-H2, S-M5, Q-M1, Q-M2, Q-M3, Q-M4, Q-M5):

- **Q-H2**: Added `close?(): void | Promise<void>` to `SyncNetworkAdapter` and `SyncStorageAdapter` interfaces. Replaced structural casts in `SyncEngine.dispose()` with `typeof` narrowing.
- **T-H2**: Added `sync-engine-edge-cases.test.ts` covering: replayOfflineQueue when adapter not configured (no-op), replay with mixed success/failure, applyIncomingChanges when conflictPersistenceAdapter.saveConflicts fails, dispose() with active subscriptions, and adapter close() invocation.
- **S-M5**: Converted `OfflineQueueManager` class to exported `replayOfflineQueue(config)` function. Updated sync-engine.ts and all tests accordingly.
- **Q-M1**: Extracted `DEFAULT_FONT_SCALE`, `DEFAULT_LOCK_TIMEOUT_MINUTES`, `DEFAULT_BACKGROUND_GRACE_SECONDS` to `sync.constants.ts`. Updated `document-factory.ts`.
- **Q-M2**: Extracted `DEFAULT_COMPACTION_CHANGE_THRESHOLD` to `sync.constants.ts`. Updated `types.ts`.
- **Q-M3**: Extracted `DEFAULT_ACTIVE_CHANNEL_WINDOW_DAYS` to `sync.constants.ts`. Updated `replication-profiles.ts`.
- **Q-M4**: Moved `HYDRATION_CONCURRENCY` from `sync-engine.ts` to `sync.constants.ts`.
- **Q-M5**: Moved `MAX_RETRIES_PER_ENTRY`, `BACKOFF_BASE_MS`, `REPLAY_DOCUMENT_CONCURRENCY`, `JITTER_MIN`, `JITTER_MAX` from `offline-queue-manager.ts` to `sync.constants.ts`.
