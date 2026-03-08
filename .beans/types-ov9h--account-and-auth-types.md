---
# types-ov9h
title: Account and auth types
status: todo
type: task
created_at: 2026-03-08T14:23:13Z
updated_at: 2026-03-08T14:23:13Z
parent: types-im7i
blocked_by:
  - types-av6x
---

Domain types for accounts, authentication, sessions, and recovery keys.

## Scope

- `Account`: id (AccountId), emailHash (string), passwordHash (string — Argon2id), createdAt, updatedAt
- `AuthKey`: id, accountId, encryptedPrivateKey (Uint8Array), publicKey (Uint8Array), keyType ('encryption'|'signing'), createdAt
- `Session`: id (SessionId), accountId, deviceInfo (string — hashed/encrypted), createdAt, lastActive, revoked (boolean)
- `RecoveryKey`: id, accountId, encryptedMasterKey (Uint8Array), createdAt
- `LoginCredentials`: email (string), password (string) — input type for login
- `RegistrationInput`: email, password, recoveryKeyBackupConfirmed (boolean)
- All account data is T3 (server-visible) except encrypted key material (T1)

## Acceptance Criteria

- [ ] Account type with hashed email
- [ ] AuthKey type for encryption and signing keypairs
- [ ] Session type with revocation support
- [ ] RecoveryKey type for key recovery
- [ ] Login and registration input types
- [ ] All types exported from package index
- [ ] Unit tests for type guards

## References

- features.md section 14 (Security)
- ADR 006 (Encryption)
- ADR 011 (Key Recovery)
- ADR 013 (API Authentication)
- DB bean: db-s6p9
