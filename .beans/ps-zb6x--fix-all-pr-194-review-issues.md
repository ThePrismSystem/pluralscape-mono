---
# ps-zb6x
title: "Fix all PR #194 review issues"
status: completed
type: task
priority: normal
created_at: 2026-03-20T02:51:28Z
updated_at: 2026-03-20T03:14:21Z
---

Implement all 32 review findings from multi-model PR review of feat/sync-client-adapters

## Summary of Changes

Fixed all 32 PR #194 review findings across 7 logical commits:

1. **Schema**: Added signature columns to sync_changes and sync_snapshots (PG + SQLite), removed dead MAX_AUTOMERGE_HEADS_BYTES constant, deleted tombstone sync-queue-cleanup file, fixed RLS policies for new table names
2. **PgSyncRelayService**: Fixed TOCTOU race in submitSnapshot with atomic UPDATE WHERE, added change dedup via onConflictDoNothing, stored and returned real signatures
3. **WsNetworkAdapter**: Added dispose() method, wrapped subscriber callbacks for crash resilience, added SyncError handling to fetch methods, updated lastSeq from DocumentUpdate and fetchChangesSince, handled subscribe send errors, removed misleading generic
4. **Types**: Consolidated SyncDocumentType/DocumentKeyType as aliases of types package, added branded SystemId/BucketId/ChannelId to manifest types, fixed asService getManifest to use passed parameter, replaced 'as never' with typed interface in pwhash-offload
5. **Handlers**: Parallelized DB queries in handleSubscribeRequest and handleDocumentLoad, added SubscribeResult with skippedDocIds for subscription cap reporting
6. **SQLiteStorageAdapter**: Cached prepared statements, converted to async methods, changed INSERT OR REPLACE to INSERT OR IGNORE for changes, added close() to SqliteDriver, fixed MockSyncTransport sync throw, extracted shared better-sqlite-driver test helper
7. **Tests**: Added PgSyncRelayService integration tests (15), WsNetworkAdapter edge case tests, EncryptedRelay.asService() tests, updated all existing tests for signature columns and new return types
