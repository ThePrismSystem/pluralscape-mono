---
# db-btrp
title: PluralKit bridge sync state table
status: completed
type: task
priority: normal
created_at: 2026-03-08T18:49:42Z
updated_at: 2026-03-10T04:54:52Z
parent: db-2je4
blocked_by:
  - db-9f6f
  - db-i2gl
---

pk_bridge_state table: id (UUID PK), system_id (FK → systems, NOT NULL), version (integer, T3, NOT NULL, default 1), enabled (boolean, T3, NOT NULL, default true), pk_token_encrypted (T1 — PK API token), last_sync_at (T3, nullable), sync_direction ('to-pk' | 'from-pk' | 'bidirectional', T3), entity_mappings (T1 — maps PS entity IDs to PK IDs), error_log (T1 — sync error history), created_at (T3, NOT NULL, default NOW()), updated_at (T3). Bridge runs client-side (requires app to be open) since server cannot decrypt data.

- CHECK: `sync_direction IN ('to-pk', 'from-pk', 'bidirectional')`

### Indexes

- pk_bridge_state (system_id)

### Cascade rules

- System deletion → CASCADE: pk_bridge_state
