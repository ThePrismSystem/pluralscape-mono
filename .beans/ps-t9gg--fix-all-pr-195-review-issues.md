---
# ps-t9gg
title: "Fix all PR #195 review issues"
status: completed
type: task
priority: normal
created_at: 2026-03-20T02:49:41Z
updated_at: 2026-03-20T03:34:31Z
---

Address all critical, important, and suggested fixes from the multi-model PR #195 review: DB schema signature columns, PgSyncRelayService fixes, type unification, interface changes, WsNetworkAdapter hardening, SqliteStorageAdapter fixes, SyncEngine critical fixes and suggestions, WS handler error handling, and test coverage.

## Summary of Changes

### Section 1: DB Schema

- Added `signature` column to `syncChanges` and `syncSnapshots` in both PG and SQLite schemas
- Updated DDL helpers and test fixtures with signature data

### Section 2: PgSyncRelayService

- Store and retrieve signatures (critical fix - was fabricating empty Uint8Array)
- TOCTOU fix: added `FOR UPDATE` lock on snapshot compaction
- Idempotent duplicate change retry via dedup index check
- Added optional `limit` param to `getEnvelopesSince`
- Used single `now` timestamp for consistency

### Section 3: Type Unification

- Re-exported `SyncDocType`/`SyncKeyType` from types package as `SyncDocumentType`/`DocumentKeyType`
- Changed `bucketId`/`channelId` from `string | undefined` to `string | null` in `SyncManifestEntry`
- Updated all test fixtures (6 files) to use `null`

### Section 4: Interface Changes

- Added optional `limit` to `fetchChangesSince`, `subscribe` with `lastSyncedSeq`, `close()` to `SyncNetworkAdapter`
- Added optional `appendChanges` batch method and `close()` to `SyncStorageAdapter`
- Added optional `limit` to `SyncRelayService.getEnvelopesSince`
- Added optional `limit` to `FetchChangesRequest`, `onClose`/`onError` to `SyncTransport`

### Section 5: WsNetworkAdapter Hardening

- SyncError checks in all request methods
- Subscriber callback isolation (try/catch)
- Removed duplicate seq tracking
- Accept `lastSyncedSeq` in subscribe
- Consume SubscribeResponse catch-up changes
- Transport disconnect handling with `rejectAllPending`
- Pass `limit` through in `fetchChangesSince`

### Section 6: SqliteStorageAdapter

- All methods marked `async` (no more `Promise.resolve` wrappers)
- Added `appendChanges` batch method using transactions

### Section 7: SyncEngine Critical Fixes

- Per-document async mutex (`enqueueDocumentOperation`)
- Fixed fire-and-forget error swallowing with `onError` callback
- Persist-first inbound changes with dupe filtering
- Rollback on failed local change submission
- Paginated `fetchChangesSince` in bootstrap (1000 per page)
- Uses `session.lastSyncedSeq` instead of manual tracking
- `syncStates` stores `DocumentSyncState` directly

### Section 8: SyncEngine Suggestions

- Parallel bootstrap hydration with bounded concurrency (limit 5)
- Robust dispose with try/catch and adapter cleanup
- Pass `lastSyncedSeq` to subscribe

### Section 9: WS Handler Error Handling

- Added try/catch to `dispatchWithAccess`, ManifestRequest, SubscribeRequest, DocumentLoadRequest
- All return INTERNAL_ERROR SyncError on handler throw

### Section 10: Relay and Session Updates

- `EncryptedRelay.getEnvelopesSince` accepts optional `limit`
- `EncryptedSyncSession.restoreDocument` method added
- `asService()` passes limit through

### Section 11: Tests

- WsNetworkAdapter: timeout, SyncError responses, subscriber isolation, multi-subscriber, disconnect
- Updated mock transport with `onClose`/`onError`, `limit` support, `simulateError`
- Updated bootstrap test expectations for new signatures
- All 291 tests passing
