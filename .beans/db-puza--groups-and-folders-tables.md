---
# db-puza
title: Groups and folders tables
status: todo
type: task
priority: normal
created_at: 2026-03-08T13:32:50Z
updated_at: 2026-03-08T14:21:09Z
parent: db-2je4
blocked_by:
  - db-9f6f
  - db-i2gl
---

Group hierarchy and membership tables with archival support.

## Scope

### Tables

- **`groups`**: id (UUID PK), system_id (FK → systems, NOT NULL), parent_group_id (FK → groups, nullable — self-referential), sort_order (integer, T3), archived (boolean, T3, NOT NULL, default false), archived_at (T3, nullable), created_at (T3, NOT NULL, default NOW()), updated_at (T3), encrypted_data (T1, NOT NULL — name, image, description, color, emoji)
  - CHECK: `sort_order >= 0`
- **`group_memberships`**: group_id (FK → groups, NOT NULL), member_id (FK → members, NOT NULL) — unique: (group_id, member_id)

### Design decisions

- Hierarchical queries: recursive CTE on both dialects (SQLite supports since 3.8.3)
- Cascade: deleting a group orphans children (moves to root)

### Indexes

- group_memberships (member_id)
- group_memberships (group_id)
- groups (system_id)

## Acceptance Criteria

- [ ] groups table with self-referential parent FK
- [ ] group_memberships with unique (group_id, member_id)
- [ ] Sort order with CHECK >= 0
- [ ] archived/archived_at on groups
- [ ] created_at/updated_at on groups
- [ ] Indexes on group_memberships (member_id, group_id)
- [ ] Both dialect migrations
- [ ] Integration test: nested group hierarchy with archival

## References

- features.md section 1 (Groups/folders)
