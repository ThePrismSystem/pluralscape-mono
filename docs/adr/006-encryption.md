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

| Purpose                   | Primitive                            | Algorithm                              |
| ------------------------- | ------------------------------------ | -------------------------------------- |
| Symmetric encryption      | `crypto_aead_xchacha20poly1305_ietf` | XChaCha20-Poly1305                     |
| Asymmetric encryption     | `crypto_box`                         | X25519 + XSalsa20-Poly1305             |
| Signing                   | `crypto_sign`                        | Ed25519                                |
| Key derivation (password) | `crypto_pwhash`                      | Argon2id (64 MiB memory, 4 iterations) |
| Sub-key derivation        | `crypto_kdf`                         | BLAKE2B                                |
| Auth key hashing          | `crypto_generichash`                 | BLAKE2B (server-side verification)     |
| Local DB encryption       | SQLCipher                            | AES-256                                |

### Privacy Bucket Model

Per-bucket symmetric keys distributed via asymmetric encryption (same pattern as Proton Drive, Etebase, Keeper):

1. System owner creates a bucket → client generates a random 256-bit symmetric BucketKey
2. Content tagged with that bucket is encrypted with the BucketKey
3. When a friend is assigned to the bucket → client encrypts BucketKey with the friend's public key → encrypted key grant stored on server
4. Friend's device fetches the key grant → decrypts BucketKey with their private key → decrypts bucket content
5. On friend removal → BucketKey is rotated, all bucket content re-encrypted, remaining friends get new key grants

### Split Key Derivation (Zero-Knowledge Protocol)

A single Argon2id pass over the password produces a 64-byte output split into two independent 32-byte keys:

```
User Password + KDF Salt
  → Argon2id (64 MiB, 4 iterations) → 64 bytes
      ├── auth_key   (bytes 0–31)  → BLAKE2B hash → stored on server for verification
      └── password_key (bytes 32–63) → wraps master key (never leaves client)
```

This is the **zero-knowledge guarantee**: the server stores only a BLAKE2B hash of the auth key. It never sees the raw password, the auth key itself, or the master key.

### Key Hierarchy

```
User Password + KDF Salt
  → Argon2id → auth_key (sent to server, BLAKE2B-hashed for storage)
             → password_key (client-only, wraps master key)

Master Key (random 256-bit, generated at registration)
  → Stored server-side as encryptedMasterKey (wrapped with password_key)
  → Stored server-side as recoveryEncryptedMasterKey (wrapped with recovery key)
  → Identity Key Pair (X25519 + Ed25519) — derived via KDF sub-keys
  → Per-Bucket Keys (XChaCha20-Poly1305)
```

### Multi-Device

The master key is randomly generated at registration and stored encrypted on the server. Any device with the password can derive the password key, fetch the encrypted master key from the server, and unwrap it locally. No device-to-device key transfer needed. Mobile: Master Key cached in Keychain/Keystore behind biometrics. Web: decrypted from the server blob each session, held in memory only.

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
- Bucket key rotation on friend removal is O(bucket_size) — mitigated by lazy rotation protocol (ADR 014)
- The split key derivation doubles Argon2id output size but requires only one KDF call — no performance cost relative to a single-key derivation at the same parameters
- The server never has enough information to perform an offline brute-force attack: it holds only a BLAKE2B hash of the auth key, not the key itself or anything that can unwrap the master key

Full encryption architecture documented in `docs/planning/encryption-research.md`.

### Addendum: Independent Key Derivation via KDF

The key hierarchy diagram shows "Identity Key Pair (X25519 + Ed25519)" derived from the Master Key. The original assumption was to derive a single Ed25519 keypair and convert it to X25519 using `crypto_sign_ed25519_sk_to_curve25519` / `crypto_sign_ed25519_pk_to_curve25519`.

This approach is **not used**. Instead, both keypairs are derived independently via KDF sub-key derivation:

```
Master Key → KDF(subkeyId=1, ctx="identity") → 32-byte seed → Ed25519 keypair (signing)
Master Key → KDF(subkeyId=2, ctx="identity") → 32-byte seed → X25519 keypair (encryption)
```

Rationale:

- `react-native-libsodium` does not expose the Ed25519-to-Curve25519 conversion functions
- Independent derivation is cryptographically sound (BLAKE2B-based KDF with distinct sub-key IDs)
- Simpler implementation with no cross-algorithm dependency
- Both keypairs remain deterministically derivable from the Master Key

Note: although keypairs are deterministically derivable from the master key, they are also stored server-side as encrypted blobs (`encryptedSigningPrivateKey`, `encryptedEncryptionPrivateKey`). This allows future support for non-deterministic or rotated keypairs without a protocol break.

### Addendum: Unified KDF Profile

All Argon2id password-to-key derivations use a single profile:

- Memory: 64 MiB (`memlimit = 67108864`)
- Iterations: 4 (`opslimit = 4`)
- Output: 64 bytes (split into `auth_key` || `password_key`)

A single KDF call produces both keys. The profile is stored in `packages/crypto/src/crypto.constants.ts`.

### License

libsodium: ISC. SQLCipher Community Edition: BSD 3-Clause. Both compatible with AGPL-3.0.
