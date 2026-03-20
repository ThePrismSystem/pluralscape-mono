---
# sync-3t74
title: Server-side relay service
status: completed
type: task
priority: critical
created_at: 2026-03-19T11:39:41Z
updated_at: 2026-03-20T01:09:19Z
parent: sync-qxxo
---

Store encrypted change envelopes and snapshots in sync tables. Implement: submitChange, fetchChangesSince, submitSnapshot, fetchLatestSnapshot, fetchManifest.

## Acceptance Criteria

- Submit/fetch roundtrip: submit a change envelope, fetch it back with correct payload
- Snapshot version enforcement: snapshot only accepted if version >= current
- Manifest generation: returns list of documents with latest seq per doc
- Duplicate dedup by (docId, authorPublicKey, nonce) — resubmit returns success without double-storing
- All payloads stored as opaque encrypted blobs (server never decrypts)
- Integration tests against real PostgreSQL

## Summary of Changes

- Created `SyncRelayService` interface in `packages/sync/src/relay-service.ts`
- Added `asService()` method to `EncryptedRelay` wrapping sync methods as async
- Updated WS handlers to accept `SyncRelayService` (all now async)
- Updated `RouterContext.relay` type from `EncryptedRelay` to `SyncRelayService`
- Updated `createRouterContext` to use `relay.asService()`
- Created `PgSyncRelayService` in `apps/api/src/services/sync-relay.service.ts`
- Fixed `SyncManifestEntry.keyType` from `'master' | 'bucket'` to `DocumentKeyType`
- Updated all WS handler and router tests for async interface
