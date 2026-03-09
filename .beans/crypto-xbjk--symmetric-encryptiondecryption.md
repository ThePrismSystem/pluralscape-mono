---
# crypto-xbjk
title: Symmetric encryption/decryption
status: completed
type: task
priority: high
created_at: 2026-03-08T13:33:59Z
updated_at: 2026-03-09T22:00:18Z
parent: crypto-gd8f
blocked_by:
  - crypto-d2tj
---

Core symmetric encryption using XChaCha20-Poly1305

## Scope

- `encrypt(plaintext: Uint8Array, key: SymmetricKey, aad?: Uint8Array): EncryptedPayload`
- `decrypt(payload: EncryptedPayload, key: SymmetricKey, aad?: Uint8Array): Uint8Array`
- XChaCha20-Poly1305 AEAD with 24-byte random nonces (no nonce-reuse risk)
- `EncryptedPayload`: { ciphertext: Uint8Array, nonce: Uint8Array }
- Additional Authenticated Data (AAD) support for context binding
- JSON helpers: `encryptJSON<T>(data: T, key): EncryptedPayload` and `decryptJSON<T>(payload, key): T`
- Streaming encryption for large payloads (media files): chunked encryption with chunk index in AAD

## Acceptance Criteria

- [ ] encrypt/decrypt roundtrip works correctly
- [ ] Random nonce generated per encryption (24 bytes)
- [ ] AAD support for authenticated context binding
- [ ] JSON serialize/deserialize helpers
- [ ] Streaming encryption for large payloads
- [ ] Tamper detection: modified ciphertext fails decryption
- [ ] Unit test: roundtrip, tamper detection, AAD mismatch rejection

## References

- ADR 006 (XChaCha20-Poly1305)

## Summary of Changes\n\nImplemented `packages/crypto/src/symmetric.ts`:\n- `encrypt/decrypt` — XChaCha20-Poly1305 AEAD with AAD support\n- `encryptJSON/decryptJSON` — JSON serialization helpers\n- `encryptStream/decryptStream` — chunked AEAD with reorder/truncation protection via chunk-index AAD\n- `EncryptedPayload` and `StreamEncryptedPayload` types\n- 16 tests covering roundtrips, tamper detection, streaming edge cases
