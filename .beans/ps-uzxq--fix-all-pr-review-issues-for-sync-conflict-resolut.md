---
# ps-uzxq
title: Fix all PR review issues for sync conflict resolution & offline queue
status: completed
type: task
priority: normal
created_at: 2026-03-20T11:36:43Z
updated_at: 2026-03-20T11:57:57Z
---

Implement all fixes from multi-model review: types, adapter fixes, PostMergeValidator refactor, OfflineQueueManager causal ordering, SyncEngine integration, cleanup job extension, and test improvements across 20 files.

## Summary of Changes

### Phase 1: Types & Foundational Adapter Fixes

- Added `tombstoneNotifications` and `correctionEnvelopes` to `PostMergeValidationResult`
- Replaced `Math.random()` with `crypto.randomUUID()` in SQLite offline queue adapter
- Wrapped `deleteConfirmed` in transaction for atomicity
- Simplified `toUint8Array` helper
- Added `deleteOlderThan()` to `ConflictPersistenceAdapter` interface
- Added `$type<ConflictResolutionStrategy>()` to both PG and SQLite sync conflict schemas

### Phase 2: PostMergeValidator Refactor

- Replaced `buildEntityFieldMap()` function with module-level `ENTITY_FIELD_MAP` constant
- Batched all `session.change()` calls — each validator now collects mutations and applies them in a single change
- All validator methods now return `{ result, envelope }` tuples
- Extracted generic `detectCyclesForField()` helper, eliminating code duplication
- Extended `normalizeSortOrder` to handle `memberPhotos` and `fieldDefinitions`
- Replaced string comparison with `JSON.parse` for visibility check in friend connections
- Wired `enforceTombstones` into `runAllValidations`
- Added explanatory comment for `DocRecord` typing

### Phase 3: OfflineQueueManager Fixes

- Fixed causal ordering: failures now `break` the document loop and count remaining as skipped
- Changed `const skipped` to `let skipped`
- Added default `onError` that logs to console.error

### Phase 4: SyncEngine Integration

- Added cached `OfflineQueueManager` instance (reused instead of creating new per call)
- Added `failedConflictPersistence` retry buffer
- Made `runPostMergeValidation` async with per-validator isolation
- Added `submitCorrectionEnvelopes()` and `persistConflicts()` private methods
- After replay, loads newly-persisted changes into in-memory sessions
- Replaced empty catch blocks with `onError` logging in `dispose()`
- Added tombstone notifications to notification list

### Phase 5: Cleanup Job Extension

- Added `SYNC_CONFLICTS_RETENTION_MS` constant (90 days)
- Extended `createSyncQueueCleanupHandler` with optional `conflictPersistenceAdapter`

### Phase 6: Test Improvements

- NEW: sync-queue-cleanup.test.ts — 4 tests covering abort, cutoff, conflict cleanup, optional param
- Fixed conditional assertion in checkInRecord test (made unconditional)
- Fixed weak assertion in friendConnection test (`toBe(1)` instead of `toBeGreaterThanOrEqual(0)`)
- Added multi-validator test (sort order ties + parent cycle)
- Updated runAllValidations tests to verify new fields
- Added replay ordering verification (enqueuedAt sort order)
- Added fake timers for backoff tests
- Added causal ordering test (entry 2 fails → entry 3 skipped)
- Added SQLite-specific tests (close, unique IDs, Uint8Array)
- Added bootstrap replay and validation persistence tests to sync-engine
- Renamed E2E tombstone test with transport-level context comment
