---
# db-7er7
title: Privacy bucket tables
status: todo
type: task
priority: high
created_at: 2026-03-08T13:32:56Z
updated_at: 2026-03-08T14:21:02Z
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

## Audit Findings (002)

- Missing `friend_codes` table: system_id (FK), code (varchar unique), created_at, expires_at (nullable) — per features.md section 4
- Missing `friend_bucket_assignments` join table: friend_connection_id (FK), bucket_id (FK) — backing for assignedBucketIds
- Missing `updated_at` on friend_connections (status changes: pending -> accepted -> blocked)
- Missing `created_at` on key_grants, `revoked_at` for key rotation
- Missing `created_at` on bucket_content_tags
- Missing `created_at`, `updated_at` on buckets
- Missing unique constraint on friend_connections (system_id, friend_system_id)
- Missing unique constraint on key_grants (bucket_id, friend_user_id, key_version)
