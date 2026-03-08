# ADR 006: Encryption — libsodium with Etebase-Inspired Protocol

## Status

Accepted

## Context

Pluralscape stores highly sensitive psychiatric data. The encryption architecture must provide:

- E2E encryption — the server never sees plaintext user data
- Encryption at rest on both client and server
- Multi-device access (web, iOS, Android) without device-to-device key transfer
- Selective sharing via Privacy Buckets — the server facilitates access control without reading the data
- Self-hosting support — encryption must not depend on who runs the server
- Client-side decryption for data export (readable JSON/CSV)

The hardest architectural challenge: Privacy Buckets require the server to route encrypted data to authorized friends based on bucket membership, while never seeing the data itself.

Evaluated: Signal Protocol, Matrix/Olm/Megolm, MLS (RFC 9420), libsodium, Web Crypto API. Also evaluated Etebase as a complete backend solution.

## Decision

**Build a custom encryption layer using libsodium**, following the protocol patterns established by **Etebase** (per-collection symmetric keys, asymmetric key distribution for sharing).

### Cryptographic Primitives

| Purpose                   | Primitive                            | Algorithm                             |
| ------------------------- | ------------------------------------ | ------------------------------------- |
| Symmetric encryption      | `crypto_aead_xchacha20poly1305_ietf` | XChaCha20-Poly1305                    |
| Asymmetric encryption     | `crypto_box`                         | X25519 + XSalsa20-Poly1305            |
| Signing                   | `crypto_sign`                        | Ed25519                               |
| Key derivation (password) | `crypto_pwhash`                      | Argon2id (256MB memory, 3 iterations) |
| Sub-key derivation        | `crypto_kdf`                         | BLAKE2B                               |
| Local DB encryption       | SQLCipher                            | AES-256                               |

### Privacy Bucket Model

Per-bucket symmetric keys distributed via asymmetric encryption (same pattern as Proton Drive, Etebase, Keeper):

1. System owner creates a bucket → client generates a random 256-bit symmetric BucketKey
2. Content tagged with that bucket is encrypted with the BucketKey
3. When a friend is assigned to the bucket → client encrypts BucketKey with the friend's public key → encrypted key grant stored on server
4. Friend's device fetches the key grant → decrypts BucketKey with their private key → decrypts bucket content
5. On friend removal → BucketKey is rotated, all bucket content re-encrypted, remaining friends get new key grants

### Key Hierarchy

```
User Password
  → Argon2id → Master Key (256-bit)
    → Identity Key Pair (X25519 + Ed25519)
    → Per-Bucket Keys (XChaCha20-Poly1305)
    → Per-Device Auth Keys
```

### Multi-Device

Password-derived Master Key is deterministic — any device with the password can derive it. No device-to-device key transfer needed (unlike Matrix cross-signing). Mobile: Master Key cached in Keychain/Keystore behind biometrics. Web: re-derived from password each session, held in memory only.

### Why Not Etebase Directly

Etebase's Collection/key model maps well to Privacy Buckets, and its crypto choices (libsodium, Argon2id, XChaCha20) are sound. However, Etebase is effectively unmaintained (JS SDK last published ~2021, server on Django 3 EOL), and it lacks offline-first sync, real-time push, and queryable data — three core requirements. We adopt its protocol patterns, not its implementation.

### Why Not Signal/Matrix/MLS

- **Signal Protocol**: Designed for ephemeral message ratcheting, not persistent state. Continuous ratcheting adds complexity without benefit for stored documents.
- **Matrix/Olm/Megolm**: Forward-secrecy ratchet is counterproductive for data that must remain readable. The Megolm distribution pattern (per-group key shared pairwise) is adopted, not the ratcheting.
- **MLS (RFC 9420)**: Heavyweight, designed for real-time session key agreement. Worth revisiting for inter-system direct messaging in a later phase.

## Consequences

- The encryption layer is a core competency — significant engineering investment to build and audit
- Password strength is the foundation of security (mitigated by Argon2id with high memory cost + zxcvbn enforcement)
- Key loss = data loss (mitigated by recovery keys and optional social recovery)
- The server sees metadata (timestamps, bucket membership graphs, activity patterns) even with E2E encryption — accept for V1, consider "Maximum Privacy" mode later
- Web clients are inherently weaker (no hardware-backed key storage, JS tamperable by compromised server)
- Bucket key rotation on friend removal is O(bucket_size) — keep buckets reasonably sized

Full encryption architecture documented in `docs/planning/encryption-research.md`.

### License

libsodium: ISC. SQLCipher Community Edition: BSD 3-Clause. Both compatible with AGPL-3.0.
