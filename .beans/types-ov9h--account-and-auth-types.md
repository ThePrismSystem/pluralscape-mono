---
# types-ov9h
title: Account and auth types
status: completed
type: task
priority: normal
created_at: 2026-03-08T14:23:13Z
updated_at: 2026-03-09T01:56:06Z
parent: types-im7i
blocked_by:
  - types-av6x
---

Domain types for accounts, authentication, sessions, and recovery keys.

## Scope

- `Account`: id (AccountId), emailHash (string), emailSalt (string — for deterministic email hash verification), passwordHash (string — Argon2id), createdAt, updatedAt
- `AuthKey`: id, accountId, encryptedPrivateKey (Uint8Array), publicKey (Uint8Array), keyType ('encryption' | 'signing'), createdAt
- `Session`: id (SessionId), accountId, deviceInfo (DeviceInfo), createdAt, lastActive, revoked (boolean)
- `DeviceInfo`: { platform: string, appVersion: string, deviceName: string }
- `RecoveryKey`: id, accountId, encryptedMasterKey (Uint8Array), createdAt
- `LoginCredentials`: email (string), password (string) — input type for login
- `RegistrationInput`: email, password, recoveryKeyBackupConfirmed (boolean)
- `DeviceTransferRequest`: id, sourceSessionId, targetSessionId, createdAt, expiresAt, status ('pending' | 'approved' | 'expired')
- `DeviceTransferPayload`: encryptedMasterKey (Uint8Array — encrypted for target device's public key)
- All account data is T3 (server-visible) except encrypted key material (T1)

## Acceptance Criteria

- [x] Account type with passwordHash and updatedAt
- [x] AuthKey type for encryption and signing keypairs
- [x] Session type with structured DeviceInfo
- [x] RecoveryKey type for key recovery
- [x] DeviceTransferRequest and DeviceTransferPayload per ADR 011
- [x] Login and registration input types
- [x] All types exported from package index
- [x] Unit tests for type-level assertions

## References

- features.md section 14 (Security)
- ADR 006 (Encryption)
- ADR 011 (Key Recovery)
- ADR 013 (API Authentication)
- DB bean: db-s6p9

## Summary of Changes

Added Account, AuthKey, Session, DeviceInfo, RecoveryKey, LoginCredentials, RegistrationInput, DeviceTransferRequest, DeviceTransferPayload types. Added 3 new branded IDs (AuthKeyId, RecoveryKeyId, DeviceTransferRequestId) with prefixes and EntityType members. Full type-level test coverage.
