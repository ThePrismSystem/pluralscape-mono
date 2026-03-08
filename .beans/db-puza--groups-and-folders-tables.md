---
# db-puza
title: Groups and folders tables
status: todo
type: task
priority: normal
created_at: 2026-03-08T13:32:50Z
updated_at: 2026-03-08T13:36:25Z
parent: db-2je4
blocked_by:
  - db-9f6f
  - db-i2gl
---

Group hierarchy and membership tables

Group hierarchy and membership tables.

## Scope

- `groups`: id, system_id, parent_group_id (nullable FK → groups — self-referential), sort_order, encrypted_data (T1 — name, image, description, color, emoji)
- `group_memberships`: group_id (FK), member_id (FK) — M:N join table
- Hierarchical queries: recursive CTE on PostgreSQL, iterative on SQLite
- Cascade rules: deleting a group orphans children (moves to root)

## Acceptance Criteria

- [ ] groups table with self-referential parent FK
- [ ] group_memberships M:N join table
- [ ] Sort order column for drag-and-drop
- [ ] Recursive query helper (dialect-aware)
- [ ] Both dialect migrations
- [ ] Integration test: nested group hierarchy

## References

- features.md section 1 (Groups/folders)
