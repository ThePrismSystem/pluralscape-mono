---
# crypto-0jcf
title: Signature operations
status: todo
type: task
priority: normal
created_at: 2026-03-08T13:34:07Z
updated_at: 2026-03-08T13:35:43Z
parent: crypto-gd8f
blocked_by:
  - crypto-d2tj
---

Ed25519 digital signature generation and verification

## Scope

- `sign(data: Uint8Array, signingKey: Ed25519PrivateKey): Signature`
- `verify(data: Uint8Array, signature: Signature, publicKey: Ed25519PublicKey): boolean`
- Sign encrypted data for integrity verification
- Sign sync operations for authenticity
- Combined helpers: `signThenEncrypt(data, signingKey, encryptionKey)` and `decryptThenVerify(blob, decryptionKey, signingPublicKey)`

## Acceptance Criteria

- [ ] sign/verify roundtrip
- [ ] Signature type is branded
- [ ] Combined sign-then-encrypt helper
- [ ] Combined decrypt-then-verify helper
- [ ] Tampered data fails verification
- [ ] Wrong public key fails verification
- [ ] Unit tests for all paths

## References

- ADR 006 (Ed25519)
