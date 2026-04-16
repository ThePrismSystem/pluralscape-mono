---
# ps-cfbv
title: "PR 455 review fixes: stale-size bug, O(n^2) spread, test improvements"
status: completed
type: task
priority: normal
created_at: 2026-04-16T12:15:25Z
updated_at: 2026-04-16T12:19:43Z
---

Implement all review feedback from PR 455 (fix/m9-sync-cleanup): fix EvictionCache stale-size bug, fix O(n^2) spread in persistConflicts, extract FailedConflictBatch type, add onParseWarning callback, guard OnDemandLoader seq with Math.max, replace brittle sort spy test, add edge case tests.

## Summary of Changes

### storage-budget.ts

- **Stale-size bug fix**: `buildSortedEvictable` now returns `string[]` (doc IDs only). `selectFromSortedEvictable` looks up current sizes from the live `documents` map via `documents.get(docId) ?? 0`. `EvictionCache.cachedEvictable` is now `string[] | null`.
- **onParseWarning callback**: Added optional `onParseWarning` to `buildSortedEvictable` and `EvictionCache` constructor. Invoked when `parseDocumentId` throws in the filter.

### sync-engine.ts

- **FailedConflictBatch type**: Extracted inline type to a named exported interface.
- **O(n^2) fix**: `persistConflicts` now uses a local mutable `failed` array with `push()` instead of spreading into `this.failedConflictPersistence` per failure. Cap logic also reads from the local array.

### on-demand-loader.ts

- **Math.max seq guard**: `load()` now uses `Math.max(prev, result.syncState.lastSyncedSeq)` to prevent seq regression.

### storage-budget.test.ts

- Replaced brittle `Array.prototype.sort` spy test with behavioral test (add doc without invalidate, verify it's excluded).
- Added tests: live-map size reflection, `onParseWarning` fires for malformed IDs, no warnings on cached calls.

### on-demand-loader.test.ts

- Added tests: seq doesn't regress when adapter returns lower seq, `lastFetchedSeq` unchanged on load error.
