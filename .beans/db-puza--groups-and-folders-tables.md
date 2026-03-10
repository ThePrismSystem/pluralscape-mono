---
# db-puza
title: Groups and folders tables
status: completed
type: task
priority: normal
created_at: 2026-03-08T13:32:50Z
updated_at: 2026-03-10T04:54:45Z
parent: db-2je4
blocked_by:
  - db-9f6f
  - db-i2gl
---

Group hierarchy and membership tables with archival support.

## Scope

### Tables

- **`groups`**: id (UUID PK), system_id (FK → systems, NOT NULL), parent_group_id (FK → groups, nullable — self-referential, ON DELETE SET NULL), version (integer, T3, NOT NULL, default 1), sort_order (integer, T3), archived (boolean, T3, NOT NULL, default false), archived_at (T3, nullable), created_at (T3, NOT NULL, default NOW()), updated_at (T3), encrypted_data (T1, NOT NULL — name, image, description, color, emoji)
  - CHECK: `sort_order >= 0`
- **`group_memberships`**: group_id (FK → groups, NOT NULL), member_id (FK → members, NOT NULL), system_id (FK → systems, NOT NULL — for RLS), created_at (T3, NOT NULL, default NOW()) — composite PK: (group_id, member_id)

### Design decisions

- Hierarchical queries: recursive CTE on both dialects (SQLite supports since 3.8.3)
- Cascade: parent_group_id ON DELETE SET NULL (orphans children to root)

### Cascade rules

- System deletion → CASCADE: groups, group_memberships
- Group deletion → CASCADE: group_memberships

### Indexes

- group_memberships (member_id)
- group_memberships (group_id)
- groups (system_id)

## Acceptance Criteria

- [ ] version on groups for CRDT
- [ ] parent_group_id ON DELETE SET NULL
- [ ] group_memberships with system_id for RLS, composite PK, created_at
- [ ] CASCADE on system and group deletion
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
