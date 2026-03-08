---
# crypto-j381
title: Recovery key encrypted backup
status: todo
type: task
priority: normal
created_at: 2026-03-08T19:56:50Z
updated_at: 2026-03-08T19:56:50Z
parent: crypto-89v7
blocked_by:
  - crypto-sa91
---

Encrypt MasterKey with recovery key and manage the encrypted backup blob on the server.

## Scope

- Generate encrypted copy of MasterKey using RecoveryKey (XChaCha20-Poly1305)
- Upload encrypted blob to server (server stores opaque ciphertext only)
- Retrieve and decrypt MasterKey blob when recovery key is presented
- Recovery key format: 256-bit encoded as `XXXX-XXXX-XXXX-XXXX-XXXX-XXXX` human-readable string
- Server API endpoints: store backup blob, retrieve backup blob (authenticated by account, not by key knowledge)
- Zero-knowledge: server never sees plaintext RecoveryKey or MasterKey

## Acceptance Criteria

- [ ] MasterKey encrypted with RecoveryKey and stored as server blob
- [ ] Encrypted blob retrievable by authenticated account
- [ ] Decryption with correct RecoveryKey yields original MasterKey
- [ ] Server stores only ciphertext (zero-knowledge verified)
- [ ] Recovery key format validation (human-readable, 256-bit)
- [ ] Unit tests for encrypt/decrypt round-trip
- [ ] Integration test: store and retrieve backup blob

## References

- ADR 011 (Key Recovery — Path 1: Recovery key)
- ADR 006 (Encryption)
