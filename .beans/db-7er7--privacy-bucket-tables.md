---
# db-7er7
title: Privacy bucket tables
status: completed
type: task
priority: high
created_at: 2026-03-08T13:32:56Z
updated_at: 2026-03-10T01:36:51Z
parent: db-2je4
blocked_by:
  - db-9f6f
  - db-i2gl
---

Privacy bucket, content tagging, key grant, friend connection, friend code, and bucket assignment tables.

## Scope

### Tables

- **`buckets`**: id (UUID PK), system_id (FK → systems, NOT NULL), version (integer, T3, NOT NULL, default 1), created_at (T3, NOT NULL, default NOW()), updated_at (T3), encrypted_data (T1, NOT NULL — name, description)
- **`bucket_content_tags`**: entity_type (varchar, NOT NULL), entity_id (UUID, NOT NULL), bucket_id (FK → buckets, NOT NULL) — composite PK: (entity_type, entity_id, bucket_id). T3 (server routes by this).
- **`key_grants`**: id (UUID PK), bucket_id (FK → buckets, NOT NULL), friend_system_id (UUID, FK → systems, NOT NULL), encrypted_key (bytea, T2 — bucket key encrypted with friend's public key), key_version (integer, NOT NULL), created_at (T3, NOT NULL, default NOW()), revoked_at (T3, nullable — set during key rotation)
  - Unique: (bucket_id, friend_system_id, key_version)
  - CHECK: `key_version >= 1`
- **`friend_connections`**: id (UUID PK), system_id (FK → systems, NOT NULL), friend_system_id (FK → systems, NOT NULL), status ('pending' | 'accepted' | 'blocked' | 'removed', T3), encrypted_data (T1, nullable — FriendVisibilitySettings: showMembers, showGroups, showStructure, allowFrontingNotifications)
  - CHECK: `status IN ('pending', 'accepted', 'blocked', 'removed')`, created_at (T3, NOT NULL, default NOW()), updated_at (T3)
  - Unique: (system_id, friend_system_id)
  - Both system_id and friend_system_id are FKs to systems (asymmetric: requester vs recipient)
- **`friend_codes`**: id (UUID PK), system_id (FK → systems, NOT NULL), code (varchar, T3, unique, NOT NULL), created_at (T3, NOT NULL, default NOW()), expires_at (T3, nullable)
  - CHECK: `expires_at IS NULL OR expires_at > created_at`
- **`friend_bucket_assignments`**: friend_connection_id (FK → friend_connections, NOT NULL), bucket_id (FK → buckets, NOT NULL) — composite PK

### Cascade rules

- Bucket deletion → CASCADE: bucket_content_tags, key_grants, friend_bucket_assignments
- System deletion → CASCADE: buckets, friend_connections, friend_codes

### Indexes

- bucket_content_tags (entity_type, entity_id)
- key_grants (friend_system_id, bucket_id)
- key_grants (revoked_at)
- friend_connections (status)
- friend_codes (system_id)

## Acceptance Criteria

- [x] version on buckets for CRDT
- [x] key_grants.friend_system_id (renamed from friend_user_id)
- [x] CHECK: key_version >= 1, friend_connections.status, friend_codes.expires_at
- [x] Index on friend_codes (system_id)
- [x] buckets table with UUID id and timestamps
- [x] bucket_content_tags with composite PK (entity_type, entity_id, bucket_id)
- [x] key_grants with versioned encrypted key blob and revoked_at for rotation
- [x] friend_connections with status enum and unique (system_id, friend_system_id)
- [x] friend_codes table with unique code and optional expiry
- [x] friend_bucket_assignments join table for friend-to-bucket mapping
- [x] CASCADE rules on bucket and system deletion
- [x] Migrations for both dialects
- [x] FriendVisibilitySettings in friend_connections encrypted_data
- [x] Integration test: full bucket → tag → grant → friend code flow

## References

- ADR 006 (Privacy Bucket Model)
- features.md section 4 (Privacy and Social)

## Summary of Changes

Added 6 privacy tables (PG + SQLite): buckets, bucket_content_tags, key_grants, friend_connections, friend_codes, friend_bucket_assignments. All with CHECK constraints, unique constraints, CASCADE rules, indexes, and 52 integration tests.
