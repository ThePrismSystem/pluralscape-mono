---
# db-i2gl
title: Core tables
status: todo
type: task
priority: high
created_at: 2026-03-08T13:32:44Z
updated_at: 2026-03-08T14:20:56Z
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

Core database tables for systems and members — the foundational entities all other tables reference.

## Scope

### Tables

- **`systems`**: id (UUID PK, NOT NULL), account_id (FK → accounts, NOT NULL), created_at (T3, NOT NULL, default NOW()), updated_at (T3), encrypted_data (T1 — name, description, avatar_ref, display_name)
- **`members`**: id (UUID PK, NOT NULL), system_id (FK → systems, NOT NULL), completeness_level ('fragment' | 'demi-member' | 'full', T3), version (integer, T3, NOT NULL, default 1 — for CRDT optimistic locking), archived (boolean, T3, NOT NULL, default false), archived_at (T3, nullable), created_at (T3, NOT NULL, default NOW()), updated_at (T3), encrypted_data (bytea/blob, T1, NOT NULL — name, pronouns, description, avatar ref, colors, role tags)
- **`member_photos`**: id (UUID PK), member_id (FK → members, NOT NULL), system_id (FK → systems, NOT NULL — for RLS policy), sort_order (integer, T3), encrypted_data (T1, NOT NULL — url/caption)

### Cascade rules

- System deletion → CASCADE: members, member_photos (GDPR purge path)
- Member deletion → CASCADE: member_photos

### Indexes

- members (system_id), (archived), (created_at)
- member_photos (member_id), (system_id)

## Acceptance Criteria

- [ ] systems table with account_id FK
- [ ] members table with encrypted_data blob column
- [ ] version column on members for CRDT optimistic locking (default 1)
- [ ] member_photos table with system_id FK for RLS
- [ ] NOT NULL on id, system_id, account_id, encrypted_data, created_at
- [ ] DEFAULT: archived = false, version = 1
- [ ] CASCADE on system deletion → members, member_photos
- [ ] Migrations for both dialects
- [ ] Integration test: insert/select with both dialects

## References

- features.md section 1 (Identity Management)
