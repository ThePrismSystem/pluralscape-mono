---
# ps-t6rc
title: "PR #193 review fixes: signature columns, async fixes, dedup, error handling, perf, type cleanup"
status: completed
type: task
priority: normal
created_at: 2026-03-20T02:48:49Z
updated_at: 2026-03-20T03:32:18Z
---

Implement all 8 commits from the PR #193 review plan: signature columns, async/manifest fixes, dedup/TOCTOU, error handling, parallel reads, type consolidation, stale job removal, integration tests

## Summary of Changes

All 8 commits from the PR #193 review plan implemented:

1. **Signature columns**: Added `signature` binary columns to `sync_changes` and `sync_snapshots` in both PG and SQLite schemas, plus snapshot version check constraint
2. **Async/manifest fixes**: Made `asService` `submitSnapshot` async, fixed `getManifest` to use caller's systemId
3. **Dedup/TOCTOU**: Added dedup check in `submit()`, rewrote `submitSnapshot()` with atomic UPDATE to eliminate TOCTOU race, stored signatures, extracted mapper methods
4. **Error handling**: Added try/catch to `dispatchWithAccess`, ManifestRequest, SubscribeRequest, and DocumentLoadRequest handlers
5. **Parallel reads**: Replaced sequential awaits with `Promise.all` in `handleSubscribeRequest` and `handleDocumentLoad`
6. **Type consolidation**: Derived `SyncDocumentType` and `DocumentKeyType` from `@pluralscape/types` package
7. **Stale cleanup**: Removed `sync-queue-cleanup` from 8 files + deleted dead query file
8. **Integration tests**: Added `PgSyncRelayService` unit tests covering all methods
