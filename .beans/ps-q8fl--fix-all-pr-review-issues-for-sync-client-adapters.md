---
# ps-q8fl
title: Fix all PR review issues for sync-client-adapters
status: completed
type: task
priority: normal
created_at: 2026-03-20T04:44:41Z
updated_at: 2026-04-16T07:29:46Z
parent: ps-afy4
---

Address 2 critical, 7 important, and 6 suggestion-level issues from PR review. Steps: null standardization, RLS policy fix, try/catch handlers, WsNetworkAdapter refactors, SqliteStorageAdapter async, EncryptedRelay.asService, parameterized SQL, blank line cleanup.

## Summary of Changes

1. **SyncManifestEntry null standardization** — Changed `bucketId` and `channelId` from `| undefined` to `| null`, aligning with `timePeriod: string | null` and DB NULL semantics
2. **Removed broken RLS policies** — Removed `sync_changes` and `sync_snapshots` from system-scoped RLS (they lack `system_id`; access control flows via FK to `sync_documents`)
3. **Wrapped read handlers in try/catch** — `dispatchWithAccess`, `ManifestRequest`, `SubscribeRequest`, and `DocumentLoadRequest` now catch and send SyncError on unexpected failure
4. **Extracted `expectResponse` helper** — WsNetworkAdapter deduplicates SyncError/unexpected-type checks across 4 methods
5. **Fixed `submitSnapshot` error details** — Non-VERSION_CONFLICT SyncErrors now surface error code and message instead of generic 'Unexpected response'
6. **Moved `correlationId` into `request()`** — Callers no longer generate UUIDs; `request()` handles it internally with a distributive Omit type
7. **Added error handling for subscribe/unsubscribe** — Subscribe catch logs warning, subscriber callback catch logs warning, unsubscribe send failure silently caught
8. **Made SqliteStorageAdapter methods `async`** — Removed `Promise.resolve()` wrappers; sync throws automatically become rejected promises
9. **EncryptedRelay.asService() cleanup** — Used `async` functions with descriptive parameter names
10. **Parameterized SQL in test helper** — Replaced string interpolation with `client.query(sql, params)` pattern
11. **Removed extra blank line** — handlers.ts import formatting
