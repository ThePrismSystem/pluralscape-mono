---
# ps-ee4w
title: Fix all PR review issues for sync infrastructure
status: completed
type: task
priority: normal
created_at: 2026-03-20T04:46:22Z
updated_at: 2026-03-20T05:01:02Z
parent: sync-qxxo
---

Address all 20 issues (5 critical, 7 important, 8 suggestions) from sync PR review across 6 commits

## Summary of Changes

### Commit 1: refactor(sync): remove type aliases and tombstone file

- Removed SyncDocumentType/DocumentKeyType aliases from document-types.ts
- Updated all consumers to import SyncDocType/SyncKeyType directly from @pluralscape/types
- Updated index.ts re-exports
- Deleted tombstone file packages/db/src/queries/sync-queue-cleanup.ts
- Removed tombstone comment from packages/db/src/queries/index.ts

### Commit 2: fix(sync): address SyncEngine correctness and observability issues

- Stored config as single field (S16)
- Tracked failed hydrations with failedDocIds set and skip eviction for failed docs (C3 + I12)
- Added console.warn for hydration failures and subscription callback errors (C4)
- Passed lastSeq to fromSnapshot during hydration (C2)
- Rewrote handleIncomingChanges to apply CRDT before persisting (I6 + S15)
- Renamed serverSnapshotSeq/localSnapshotSeq to serverSnapshotVersion/localSnapshotVersion (S18)
- Added tests for failed hydration tracking, logging, CRDT-before-persist order

### Commit 3: fix(sync): add SyncError handling and dispose guards to WsNetworkAdapter

- Added SyncError checks to fetchChangesSince, fetchLatestSnapshot, fetchManifest (I8)
- Added SyncError handling in subscribe .then() with cleanup (C5)
- Added transport error logging in subscribe .catch()
- Added this.disposed guard in unsubscribe closure (I9)
- Removed generic from PendingRequest interface (S17)
- Added comprehensive tests for all SyncError and dispose scenarios

### Commit 4: fix(sync): improve compaction handler error observability

- Added localSaveFailed field to CompactionResult (I7)
- Added console.warn and error capture in local save/prune catch block
- Removed unnecessary `as CompactionReason` cast (S19)
- Added tests for localSaveFailed flag and warning logging

### Commit 5: fix(sync): fix seq leak in PgSyncRelayService and add integration tests

- Restructured submit() to check dedup key before incrementing seq (C1)
- Added systemId scoping JSDoc to PgSyncRelayService class (I10)
- Created integration test file with PGlite (I11)
- Tests: incrementing seq, dedup idempotency, non-existent doc, getEnvelopesSince, submitSnapshot, VERSION_CONFLICT, getLatestSnapshot, getManifest

### Commit 6: refactor(sync): inline sinceSeq constant in handleDocumentLoad

- Inlined sinceSeq = 0 directly into getEnvelopesSince call (S20)
