---
# crypto-l3hj
title: Identity keypair generation
status: todo
type: task
priority: high
created_at: 2026-03-08T13:33:57Z
updated_at: 2026-03-08T13:35:44Z
parent: crypto-gd8f
blocked_by:
  - crypto-afug
---

Identity keypair generation for encryption and signing

## Scope

- `generateIdentityKeypair(masterKey: MasterKey): { encryption: X25519Keypair, signing: Ed25519Keypair }`
- Deterministic derivation from master key via crypto_kdf (sub-key derivation)
- X25519 keypair for asymmetric encryption (key exchange)
- Ed25519 keypair for digital signatures
- Private key encryption with master key for server storage: `encryptPrivateKey(privateKey, masterKey): EncryptedBlob`
- Private key decryption: `decryptPrivateKey(blob, masterKey): PrivateKey`
- Public key serialization for directory storage
- Branded types: `X25519PublicKey`, `X25519PrivateKey`, `Ed25519PublicKey`, `Ed25519PrivateKey`

## Acceptance Criteria

- [ ] Keypair generation from master key (deterministic)
- [ ] X25519 and Ed25519 keypairs generated
- [ ] Private key encrypt/decrypt with master key
- [ ] Public key export for server storage
- [ ] Branded key types prevent misuse
- [ ] Unit test: generate → encrypt → decrypt → verify same keys
- [ ] Unit test: deterministic (same master key = same keypairs)

## References

- ADR 006 section 4.2 (Key Hierarchy)
