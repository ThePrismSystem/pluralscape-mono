---
# db-7er7
title: Privacy bucket tables
status: todo
type: task
priority: high
created_at: 2026-03-08T13:32:56Z
updated_at: 2026-03-08T13:36:25Z
parent: db-2je4
blocked_by:
  - db-9f6f
  - db-i2gl
---

Privacy bucket, content tagging, key grant, and friend connection tables

## Scope

- `buckets`: id (UUID), system_id, encrypted_data (T1 — name, description)
- `bucket_content_tags`: entity_type (varchar), entity_id (UUID), bucket_id (FK) — T3 (server routes by this)
- `key_grants`: id, bucket_id (FK), friend_user_id, encrypted_key (bytea — T2, bucket key encrypted with friend's public key), key_version (integer)
- `friend_connections`: id, system_id, friend_system_id, status ('pending'|'accepted'|'blocked'), created_at — T3
- Indexes: bucket_content_tags (entity_type, entity_id), key_grants (friend_user_id, bucket_id)

## Acceptance Criteria

- [ ] buckets table with UUID id
- [ ] bucket_content_tags with entity polymorphism (type + id)
- [ ] key_grants with versioned encrypted key blob
- [ ] friend_connections with status enum
- [ ] Composite indexes for efficient lookups
- [ ] Migrations for both dialects
- [ ] Integration test: full bucket → tag → grant flow

## References

- ADR 006 (Privacy Bucket Model)
- encryption-research.md section 4
