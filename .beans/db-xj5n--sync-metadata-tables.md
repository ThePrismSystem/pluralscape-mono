---
# db-xj5n
title: Sync metadata tables
status: todo
type: task
created_at: 2026-03-08T14:22:47Z
updated_at: 2026-03-08T14:22:47Z
parent: db-2je4
blocked_by:
  - db-9f6f
  - db-i2gl
---

Tables for tracking CRDT sync state, offline write queue, and merge history.

## Scope

- `sync_documents`: id, system_id (FK), entity_type (varchar), entity_id (UUID), automerge_heads (bytea — current document heads), last_synced_at (T3), version (integer)
- `sync_queue`: id, system_id, entity_type, entity_id, operation ('create'|'update'|'delete'), change_data (bytea — Automerge change), created_at, synced_at (nullable)
- `sync_conflicts`: id, system_id, entity_type, entity_id, local_version (integer), remote_version (integer), resolution ('local'|'remote'|'merged'), resolved_at, details (text nullable)
- Design: sync state is per-entity for granular conflict resolution
- Design: sync_queue persists offline writes for replay on reconnect
- Indexes: sync_documents (system_id, entity_type, entity_id unique), sync_queue (system_id, synced_at null) for pending changes

## Acceptance Criteria

- [ ] sync_documents table for Automerge document state
- [ ] sync_queue table for offline write persistence
- [ ] sync_conflicts log for debugging
- [ ] Unique index on (system_id, entity_type, entity_id) for sync_documents
- [ ] Migrations for both dialects
- [ ] Integration test: record sync state, queue offline change, resolve conflict

## References

- features.md section 15 (Offline-First and Sync)
- ADR 005 (Offline Sync — Automerge CRDT)
