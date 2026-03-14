---
# crypto-sa91
title: Recovery key generation
status: completed
type: task
priority: high
created_at: 2026-03-08T13:34:10Z
updated_at: 2026-03-14T07:05:35Z
parent: crypto-gd8f
blocked_by:
  - crypto-afug
---

Recovery key generation and master key recovery

## Scope

- `generateRecoveryKey(): { displayKey: string, encryptedMasterKey: EncryptedBlob }`
- High-entropy random key (256-bit), formatted for human readability (groups of 5 alphanumeric chars, e.g., "ABCDE-FGHIJ-KLMNO-...")
- Recovery key encrypts master key with XChaCha20-Poly1305
- Encrypted master key blob stored on server
- `recoverMasterKey(displayKey: string, encryptedBlob: EncryptedBlob): MasterKey`
- Shown once at registration — UI must emphasize "write this down, cannot be shown again"

## Acceptance Criteria

- [ ] Recovery key generation (256-bit entropy)
- [ ] Human-readable format (grouped alphanumeric)
- [ ] Master key encryption with recovery key
- [ ] Master key recovery from display key + blob
- [ ] Roundtrip test: generate → encrypt → recover
- [ ] Format validation for display key input
- [ ] Unit tests

## References

- ADR 011 (Key Lifecycle and Recovery)

## Summary of Changes

- Added `generateRecoveryKey(masterKey)` — 32 random bytes, RFC 4648 base32, 13×4 dash-separated groups, encrypts master key, memzeros recovery bytes
- Added `recoverMasterKey(displayKey, encryptedMasterKey)` — validates format, decodes base32, decrypts, memzeros in finally
- Added `isValidRecoveryKeyFormat(displayKey)` — regex validation for 13 groups of 4 base32 chars
- Base32 encode/decode implemented from scratch with named constants for all magic numbers
- 27 unit tests covering roundtrips, format validation, wrong-key errors, tamper detection, and memzero paths
