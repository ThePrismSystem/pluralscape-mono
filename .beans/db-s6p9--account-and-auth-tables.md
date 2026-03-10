---
# db-s6p9
title: Account and auth tables
status: completed
type: task
priority: high
created_at: 2026-03-08T13:33:22Z
updated_at: 2026-03-09T23:59:31Z
parent: db-2je4
blocked_by:
  - db-9f6f
---

Account, authentication key, session, and recovery tables. Foundation for crypto key storage and server-side authentication.

## Scope

### Tables

- **`accounts`**: id (UUID PK, NOT NULL), version (integer, T3, NOT NULL, default 1), email_hash (varchar, T3, NOT NULL — hashed, not plaintext), email_salt (varchar, T3, NOT NULL — for deterministic email hash verification), password_hash (varchar, T3, NOT NULL — Argon2id hash for server-side auth), created_at (T3, NOT NULL, default NOW()), updated_at (T3)
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

- [x] accounts table with hashed email and Argon2id password hash
- [x] email_salt column for deterministic email verification
- [x] auth_keys table for encryption and signing keypairs
- [x] sessions table with revocation support (default false)
- [x] recovery_keys table for key recovery flow
- [x] Unique index on email_hash
- [x] NOT NULL on id, email_hash, password_hash, created_at
- [x] DEFAULT: created_at = NOW(), sessions.revoked = false
- [x] CASCADE on account deletion → sessions, auth_keys, recovery_keys
- [x] Migrations for both dialects
- [x] version column on accounts for CRDT
- [x] device_transfer_requests table with expiry and status tracking
- [x] Integration test: full account + key + session creation flow

## References

- ADR 006 (Key Hierarchy)
- ADR 011 (Key Lifecycle and Recovery)
- ADR 013 (API Authentication)

### Additional tables (from audit C7)

- **`device_transfer_requests`**: id (UUID PK), account_id (FK → accounts, NOT NULL — DB-only, not in type; needed for cascade), source_session_id (UUID FK → sessions, T3, NOT NULL), target_session_id (UUID FK → sessions, T3, NOT NULL), status ('pending' | 'approved' | 'expired', T3, NOT NULL, default 'pending'), created_at (T3, NOT NULL, default NOW()), expires_at (T3, NOT NULL)
  - Encrypted master key payload (DeviceTransferPayload) is handled at the application layer, not stored as a column
  - CHECK: `expires_at > created_at`
  - Account deletion → CASCADE: device_transfer_requests
  - Index: device_transfer_requests (account_id, status)

## Summary of Changes

Implemented all 5 auth tables (accounts, auth_keys, sessions, recovery_keys, device_transfer_requests) in both PG and SQLite dialects with CHECK constraints, FK cascades, and indexes. Full integration tests covering all columns, defaults, constraints, cascades, and binary round-trips.
