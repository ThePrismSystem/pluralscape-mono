---
# crypto-0jcf
title: Signature operations
status: completed
type: task
priority: normal
created_at: 2026-03-08T13:34:07Z
updated_at: 2026-03-14T09:29:05Z
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

- [x] sign/verify roundtrip
- [x] Signature type is branded
- [x] Combined sign-then-encrypt helper
- [x] Combined decrypt-then-verify helper
- [x] Tampered data fails verification
- [x] Wrong public key fails verification
- [x] Unit tests for all paths

## References

- ADR 006 (Ed25519)

## Summary of Changes

Added `sign`, `verify`, `signThenEncrypt`, and `decryptThenVerify` to `sign.ts`. Wire format: `signature (64B) || plaintext`. Added `SignatureVerificationError` to `errors.ts`. 12 tests passing.
