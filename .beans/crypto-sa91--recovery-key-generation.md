---
# crypto-sa91
title: Recovery key generation
status: in-progress
type: task
priority: high
created_at: 2026-03-08T13:34:10Z
updated_at: 2026-03-14T06:50:27Z
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
