---
# db-3h1c
title: API key tables
status: todo
type: task
priority: normal
created_at: 2026-03-08T14:03:42Z
updated_at: 2026-03-09T23:01:29Z
parent: db-2je4
blocked_by:
  - db-9f6f
  - db-s6p9
---

API key storage with scoped permissions per ADR 013. Distinct from auth_keys (user E2E keypairs).

## Scope

### Tables

- **`api_keys`**: id (UUID PK), account_id (FK → accounts, NOT NULL), system_id (FK → systems, NOT NULL), name (varchar, T3, NOT NULL), key_type ('metadata' | 'crypto', T3, NOT NULL), token_hash (varchar, T3, NOT NULL), scopes (varchar[] or JSON, T3, NOT NULL), encrypted_key_material (bytea, nullable — only for crypto keys, T1), created_at (T3, NOT NULL, default NOW()), last_used_at (T3, nullable), revoked_at (T3, nullable), expires_at (T3, nullable), scoped_bucket_ids (varchar[] or JSON, T3, nullable — restrict key to specific buckets)

### Design decisions

- token_hash stores bcrypt/argon2 hash of the bearer token (plaintext shown once at creation)
- scopes are T3 (server must evaluate permissions on each request)
- encrypted_key_material is T1 (only for crypto-type keys)
- scopes use customType from db-9f6f for varchar[]/JSON portability

### Cascade rules

- Account deletion → CASCADE: api_keys

### Indexes

- api_keys (account_id)
- api_keys (token_hash) — unique
- api_keys (revoked_at) — for active keys filter
- api_keys (key_type) — for type filter

## Acceptance Criteria

- [ ] api_keys table with metadata and crypto key variants
- [ ] Token hash for bearer token verification
- [ ] Scopes stored for server-side permission checking
- [ ] Encrypted key material for crypto keys only
- [ ] Revocation support via revoked_at
- [ ] Unique index on token_hash
- [ ] Indexes on revoked_at and key_type
- [ ] Migrations for both dialects
- [ ] system_id FK for tenant isolation
- [ ] expires_at for key expiration
- [ ] scoped_bucket_ids for bucket-scoped access control
- [ ] Integration test: create both key types, verify token hash lookup

## References

- features.md section 9 (Public REST API, hybrid auth model)
- ADR 013 (API Authentication with E2E Encryption)
