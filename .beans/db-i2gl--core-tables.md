---
# db-i2gl
title: Core tables
status: todo
type: task
priority: high
created_at: 2026-03-08T13:32:44Z
updated_at: 2026-03-08T13:36:25Z
parent: db-2je4
blocking:
  - db-82q2
  - db-puza
  - db-tu5g
  - db-7er7
  - db-k37y
  - db-kk2l
  - db-ju0q
  - db-8su3
  - db-vfhd
  - db-771z
blocked_by:
  - db-9f6f
---

Core database tables for systems and members

## Scope

- `systems` table: id (UUID), account_id (FK → accounts), created_at, updated_at
- `members` table: id (UUID), system_id (FK → systems), encrypted_data (bytea/blob — T1 encrypted), completeness_level ('fragment'|'demi-member'|'full'), archived (boolean), archived_at (nullable), created_at, updated_at
- `member_photos` table: id, member_id (FK), encrypted_data (T1 — url/caption), sort_order
- Indexes: members.system_id, members.archived, members.created_at
- Encrypted fields (inside encrypted_data blob): name, pronouns, description, avatar ref, colors, role tags
- Plaintext fields: id, system_id, completeness_level, archived, timestamps

## Acceptance Criteria

- [ ] systems table defined for both PG and SQLite
- [ ] members table with encrypted_data blob column
- [ ] member_photos table with sort ordering
- [ ] Foreign key constraints: systems.account_id → accounts, members.system_id → systems
- [ ] Appropriate indexes on system_id, archived, created_at
- [ ] Migration generated and tested for both dialects
- [ ] Insert/select integration test with both dialects

## References

- encryption-research.md section 4.3 (which fields are T1 vs T3)
