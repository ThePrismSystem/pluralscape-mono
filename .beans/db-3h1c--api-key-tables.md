---
# db-3h1c
title: API key tables
status: todo
type: task
priority: normal
created_at: 2026-03-08T14:03:42Z
updated_at: 2026-03-08T14:21:28Z
parent: db-2je4
blocked_by:
  - db-9f6f
  - db-s6p9
---

API key storage with scoped permissions per ADR 013. Distinct from auth_keys (user E2E keypairs).

## Scope

- `api_keys`: id, account_id (FK), name (varchar — T3, user label), key_type ('metadata' | 'crypto' — T3), token_hash (varchar — T3, hashed bearer token), scopes (varchar[] or JSON — T3), encrypted_key_material (bytea nullable — only for crypto keys, T1), created_at (T3), last_used_at (T3 nullable), revoked_at (T3 nullable)
- Design: token_hash stores bcrypt/argon2 hash of the bearer token (plaintext shown once at creation)
- Design: scopes are T3 (server must evaluate permissions on each request)
- Design: encrypted_key_material is T1 (user's encryption key material, only for crypto-type keys)
- Indexes: api_keys (account_id), api_keys (token_hash unique)

## Acceptance Criteria

- [ ] api_keys table with metadata and crypto key variants
- [ ] Token hash for bearer token verification (not plaintext)
- [ ] Scopes stored for server-side permission checking
- [ ] Encrypted key material for crypto keys only
- [ ] Revocation support (revoked_at nullable timestamp)
- [ ] Unique index on token_hash
- [ ] Migrations for both dialects
- [ ] Integration test: create both key types, verify token hash lookup

## References

- features.md section 9 (Public REST API, hybrid auth model)
- ADR 013 (API Authentication with E2E Encryption)

## Audit Findings (002)

- Missing indexes on api_keys: revoked_at (active keys filter), key_type (type filter)
