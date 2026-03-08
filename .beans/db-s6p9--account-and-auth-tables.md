---
# db-s6p9
title: Account and auth tables
status: todo
type: task
priority: high
created_at: 2026-03-08T13:33:22Z
updated_at: 2026-03-08T13:36:25Z
parent: db-2je4
blocked_by:
  - db-9f6f
---

Account, authentication key, session, and recovery tables. Needed for crypto key storage.

## Scope

- `accounts`: id (UUID), email_hash (varchar — hashed, not plaintext), created_at (T3)
- `auth_keys`: id, account_id (FK), encrypted_private_key (bytea — private key encrypted with master key), public_key (bytea — T3, plaintext for key directory), key_type ('encryption'|'signing'), created_at
- `sessions`: id, account_id (FK), device_info (T3 — encrypted or hashed), created_at, last_active, revoked (boolean)
- `recovery_keys`: id, account_id (FK), encrypted_master_key (bytea — master key encrypted with recovery key), created_at
- Indexes: accounts.email_hash (unique), auth_keys.account_id, sessions.account_id

## Acceptance Criteria

- [ ] accounts table with hashed email (not plaintext)
- [ ] auth_keys table for encryption and signing keypairs
- [ ] sessions table with revocation support
- [ ] recovery_keys table for key recovery flow
- [ ] Unique index on email_hash
- [ ] Migrations for both dialects
- [ ] Integration test: full account + key + session creation flow

## References

- ADR 006 (Key Hierarchy)
- ADR 011 (Key Lifecycle and Recovery)
- ADR 013 (API Authentication)
