---
# types-m7dm
title: Sync and CRDT types
status: completed
type: task
priority: normal
created_at: 2026-03-08T14:23:58Z
updated_at: 2026-03-09T01:58:51Z
parent: types-im7i
blocked_by:
  - types-av6x
---

Offline-first sync state, CRDT document, and conflict resolution types.

## Scope

- `SyncDocument`: id, systemId, entityType (string), entityId (string), automergeHeads (Uint8Array), lastSyncedAt (UnixMillis), version (number)
- `SyncQueueItem`: id, systemId, entityType, entityId, operation ('create'|'update'|'delete'), changeData (Uint8Array — Automerge change), createdAt, syncedAt (UnixMillis | null)
- `SyncConflict`: id, systemId, entityType, entityId, localVersion, remoteVersion, resolution ('local'|'remote'|'merged'), resolvedAt, details (string | null)
- `SyncState`: overall sync status for a system — lastSyncedAt, pendingChanges (number), syncInProgress (boolean)
- `SyncIndicator`: UI state type for visual sync indicator (spinning icon)

## Acceptance Criteria

- [x] SyncDocument tracks Automerge document state
- [x] SyncQueueItem for offline write persistence and replay
- [x] SyncConflict for debugging merge history
- [x] SyncState for overall system sync status
- [x] Unit tests for type-level assertions

## References

- features.md section 15 (Offline-First and Sync)
- ADR 005 (Offline Sync — Automerge CRDT)

## Summary of Changes

Added SyncDocument, SyncQueueItem, SyncConflict, SyncState, SyncIndicator types with 3 union types (SyncOperation, SyncResolution, SyncIndicatorStatus). Added 3 new branded IDs (SyncDocumentId, SyncQueueItemId, SyncConflictId) with prefixes and EntityType members. Full type-level test coverage.
