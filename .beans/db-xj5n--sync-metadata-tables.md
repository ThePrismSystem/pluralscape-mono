---
# db-xj5n
title: Sync metadata tables
status: todo
type: task
priority: normal
created_at: 2026-03-08T14:22:47Z
updated_at: 2026-03-08T19:32:26Z
parent: db-2je4
blocked_by:
  - db-9f6f
  - db-i2gl
---

Tables for tracking CRDT sync state, offline write queue, and merge history.

## Scope

- `sync_documents`: id (UUID PK), system_id (FK → systems, NOT NULL), entity_type (varchar, T3, NOT NULL), entity_id (UUID, T3, NOT NULL), automerge_heads (bytea, T3), version (integer, T3, NOT NULL, default 1), created_at (T3, NOT NULL, default NOW()), last_synced_at (T3)
- `sync_queue`: id (UUID PK), system_id (FK → systems, NOT NULL), entity_type (varchar, T3, NOT NULL), entity_id (UUID, T3, NOT NULL), operation ('create'|'update'|'delete', T3, NOT NULL), change_data (bytea — Automerge change; already encrypted at entity level), created_at (T3, NOT NULL, default NOW()), synced_at (T3, nullable)
- `sync_conflicts`: id (UUID PK), system_id (FK → systems, NOT NULL), entity_type (varchar, T3, NOT NULL), entity_id (UUID, T3, NOT NULL), local_version (integer, T3, NOT NULL), remote_version (integer, T3, NOT NULL), resolution ('local'|'remote'|'merged', T3), created_at (T3, NOT NULL, default NOW()), resolved_at (T3, nullable), details (text, T3, nullable)
  - CHECK: `resolution IN ('local', 'remote', 'merged')`
- All sync metadata is T3 (server manages sync state)

### Cascade rules

- System deletion → CASCADE: sync_documents, sync_queue, sync_conflicts
- Design: sync state is per-entity for granular conflict resolution
- Design: sync_queue persists offline writes for replay on reconnect
- Indexes: sync_documents (system_id, entity_type, entity_id unique), sync_queue (system_id, synced_at null) for pending changes

## Acceptance Criteria

- [ ] All columns annotated with T3 tier
- [ ] system_id FK → systems on all 3 tables, CASCADE on deletion
- [ ] created_at on all 3 tables
- [ ] CHECK on resolution values
- [ ] sync_documents table for Automerge document state
- [ ] sync_queue table for offline write persistence
- [ ] sync_conflicts log for debugging
- [ ] Unique index on (system_id, entity_type, entity_id) for sync_documents
- [ ] Migrations for both dialects
- [ ] Integration test: record sync state, queue offline change, resolve conflict

## References

- features.md section 15 (Offline-First and Sync)
- ADR 005 (Offline Sync — Automerge CRDT)
