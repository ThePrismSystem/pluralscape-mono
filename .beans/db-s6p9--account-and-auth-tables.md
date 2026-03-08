---
# db-s6p9
title: Account and auth tables
status: todo
type: task
priority: high
created_at: 2026-03-08T13:33:22Z
updated_at: 2026-03-08T19:32:27Z
parent: db-2je4
blocked_by:
  - db-9f6f
---

Account, authentication key, session, and recovery tables. Foundation for crypto key storage and server-side authentication.

## Scope

### Tables

- **`accounts`**: id (UUID PK, NOT NULL), email_hash (varchar, T3, NOT NULL — hashed, not plaintext), email_salt (varchar, T3, NOT NULL — for deterministic email hash verification), password_hash (varchar, T3, NOT NULL — Argon2id hash for server-side auth), created_at (T3, NOT NULL, default NOW()), updated_at (T3)
- **`auth_keys`**: id (UUID PK), account_id (FK → accounts, NOT NULL), encrypted_private_key (bytea, T1 — private key encrypted with master key), public_key (bytea, T3 — plaintext for key directory), key_type ('encryption' | 'signing', T3), created_at (T3, NOT NULL, default NOW())
- **`sessions`**: id (UUID PK), account_id (FK → accounts, NOT NULL), device_info (varchar, T3 — hashed device fingerprint; NOT encrypted since server needs it for session identification), created_at (T3, NOT NULL, default NOW()), last_active (T3), revoked (boolean, T3, NOT NULL, default false)
- **`recovery_keys`**: id (UUID PK), account_id (FK → accounts, NOT NULL), encrypted_master_key (bytea, T1 — master key encrypted with recovery key), created_at (T3, NOT NULL, default NOW())

### Cascade rules

- Account deletion → CASCADE: sessions, auth_keys, recovery_keys (GDPR purge path)
- API keys cascade defined in db-3h1c; audit log cascade defined in db-k9sr

### Indexes

- accounts.email_hash (unique)
- auth_keys.account_id
- sessions.account_id
- sessions (revoked) — for active sessions filter
- recovery_keys (account_id)

## Acceptance Criteria

- [ ] accounts table with hashed email and Argon2id password hash
- [ ] email_salt column for deterministic email verification
- [ ] auth_keys table for encryption and signing keypairs
- [ ] sessions table with revocation support (default false)
- [ ] recovery_keys table for key recovery flow
- [ ] Unique index on email_hash
- [ ] NOT NULL on id, email_hash, password_hash, created_at
- [ ] DEFAULT: created_at = NOW(), sessions.revoked = false
- [ ] CASCADE on account deletion → sessions, auth_keys, recovery_keys
- [ ] Migrations for both dialects
- [ ] Integration test: full account + key + session creation flow

## References

- ADR 006 (Key Hierarchy)
- ADR 011 (Key Lifecycle and Recovery)
- ADR 013 (API Authentication)
