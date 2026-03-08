---
# crypto-gd6i
title: Password reset via recovery key
status: todo
type: task
priority: normal
created_at: 2026-03-08T19:57:10Z
updated_at: 2026-03-08T19:57:10Z
parent: crypto-89v7
blocked_by:
  - crypto-sa91
---

Full password reset flow using recovery key to regain access to encrypted data.

## Scope

- User enters RecoveryKey at password reset prompt
- Client retrieves encrypted MasterKey backup blob from server
- Client decrypts MasterKey using RecoveryKey
- User sets new password
- MasterKey re-encrypted under new password-derived key (Argon2id)
- Server credentials updated (new password hash)
- All existing sessions remain valid (MasterKey unchanged, only wrapping key changes)
- UX: make data-loss consequence of no-recovery-key extremely clear before offering fresh-start option

## Acceptance Criteria

- [ ] RecoveryKey input with validation
- [ ] Encrypted backup blob retrieval from server
- [ ] MasterKey decryption with RecoveryKey
- [ ] New password setup and MasterKey re-encryption
- [ ] Server credential update
- [ ] Existing sessions preserved
- [ ] Clear UX warning for users without recovery key
- [ ] Unit tests for full reset flow
- [ ] Integration test: password reset end-to-end

## References

- ADR 011 (Key Recovery — password reset)
- ADR 006 (Encryption — Argon2id key derivation)
