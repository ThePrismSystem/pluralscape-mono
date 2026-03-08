---
# types-m7dm
title: Sync and CRDT types
status: todo
type: task
created_at: 2026-03-08T14:23:58Z
updated_at: 2026-03-08T14:23:58Z
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

- [ ] SyncDocument tracks Automerge document state
- [ ] SyncQueueItem for offline write persistence and replay
- [ ] SyncConflict for debugging merge history
- [ ] SyncState for overall system sync status
- [ ] Unit tests for sync state transitions

## References

- features.md section 15 (Offline-First and Sync)
- ADR 005 (Offline Sync — Automerge CRDT)
