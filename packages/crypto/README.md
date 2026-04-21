# @pluralscape/crypto

Client-side encryption layer for Pluralscape — libsodium primitives, key hierarchy, and E2E encryption pipeline.

## Overview

Pluralscape enforces zero-knowledge encryption: the server never sees plaintext user data, and it never sees master-key material in any form. Every master-key operation — password-derived KEK derivation, master-key wrap/unwrap, rewrap on password change, and recovery-key rewrap — runs on the device. The server stores only an opaque ciphertext blob (`encrypted_master_key`) plus a BLAKE2b hash of the auth half of the split derivation. This package implements the full client-side cryptographic stack using [libsodium](https://libsodium.org/) (XChaCha20-Poly1305 for symmetric encryption, X25519 for asymmetric, Ed25519 for signing, Argon2id for key derivation). All encryption and decryption happens on the device before any data leaves or arrives from the server.

Data is encrypted at one of three tiers based on its sensitivity and sharing requirements. **T1** (zero-knowledge) encrypts with a sub-key derived from the system master key — only the account owner can decrypt. **T2** (per-bucket) encrypts with a per-Privacy-Bucket symmetric key distributed asymmetrically to authorized friends — enabling selective sharing without the server ever seeing the bucket key. **T3** is a typed passthrough for non-sensitive metadata fields that remain in plaintext. See [ADR 006](../../docs/adr/006-encryption.md) for the full encryption architecture, including the _Master-Key KDF Profile_ addendum.

The key hierarchy flows from a user password through Argon2id to a 64-byte split derivation — bytes `[0..31]` become the `authKey` (hashed server-side for login, never stored raw) and bytes `[32..63]` become the `passwordKey` (a KEK that wraps the 256-bit random master key on-device). The master key in turn feeds BLAKE2B KDF sub-keys for identity keypairs (X25519 + Ed25519), per-bucket symmetric keys, and the sync-encryption key. Argon2id runs under per-context profiles (`ARGON2ID_PROFILE_MASTER_KEY` for login/PIN, `ARGON2ID_PROFILE_TRANSFER` for device-transfer code stretching) so each workload gets parameters matched to its threat model — see [ADR 037](../../docs/adr/037-argon2id-context-profiles.md). Key recovery uses a generated recovery phrase that rewraps the master key independently of the password. Device transfer uses a QR-scanned ephemeral key to securely bootstrap a new device without a server round-trip. See [ADR 011](../../docs/adr/011-key-recovery.md) and [ADR 014](../../docs/adr/014-lazy-key-rotation.md) for recovery and rotation details.

## Key Exports

### Main entry (`@pluralscape/crypto`)

**Sodium lifecycle** — `initSodium`, `configureSodium`, `getSodium`, `isReady`

**Master key** — `generateSalt`, `generateMasterKey`, `wrapMasterKey`, `unwrapMasterKey`, `deriveSyncEncryptionKey`

**Split-key auth** — `deriveAuthAndPasswordKeys`, `hashAuthKey`, `verifyAuthKey`, `hashRecoveryKey`, `verifyRecoveryKey`, `generateChallengeNonce`, `signChallenge`, `verifyChallenge`

**Symmetric encryption** — `encrypt`, `decrypt`, `encryptJSON`, `decryptJSON`, `encryptStream`, `encryptStreamAsync`, `decryptStream`, `toAsyncIterable`

**Tier helpers** — `encryptTier1`, `decryptTier1`, `encryptTier1Batch`, `decryptTier1Batch`, `encryptTier2`, `decryptTier2`, `encryptTier2Batch`, `decryptTier2Batch`, `wrapTier3`

**Identity keypairs** — `generateIdentityKeypair`, `encryptPrivateKey`, `decryptPrivateKey`, `serializePublicKey`

**Bucket key management** — `generateBucketKey`, `encryptBucketKey`, `decryptBucketKey`, `rotateBucketKey`, `createBucketKeyCache`

**Key grants** — `createKeyGrant`, `createKeyGrants`, `decryptKeyGrant`

**Recovery and transfer** — `generateRecoveryKey`, `recoverMasterKey`, `isValidRecoveryKeyFormat`, `toRecoveryKeyDisplay`, `serializeRecoveryBackup`, `deserializeRecoveryBackup`, `withMasterKeyFromReset`, `withPasswordResetResult`, `regenerateRecoveryKey`, `generateTransferCode`, `isValidTransferCode`, `deriveTransferKey`, `encryptForTransfer`, `decryptFromTransfer`, `encodeQRPayload`, `decodeQRPayload`, `TRANSFER_TIMEOUT_MS`

**Signing** — `sign`, `verify`, `signThenEncrypt`, `decryptThenVerify`

**Safety numbers** — `computeSafetyNumber`

**PIN** — `hashPin`, `verifyPin`, `MIN_PIN_LENGTH`

**Key storage** — `createWebKeyStorage`

**Key lifecycle** — `MobileKeyLifecycleManager`, `SECURITY_PRESETS`

**Validation** — `assertAeadKey`, `assertAeadNonce`, `assertAuthKey`, `assertAuthKeyHash`, `assertBufferLength`, `assertChallengeNonce`, `assertEncryptedBlob`, `assertPwhashSalt`, `assertRecoveryKeyHash`, `assertSignature`, `assertSignPublicKey`

**Hex encoding** — `toHex`, `fromHex`

**Blob codec** — `serializeEncryptedBlob`, `deserializeEncryptedBlob`

**Argon2id profiles** — `ARGON2ID_PROFILE_MASTER_KEY`, `ARGON2ID_PROFILE_TRANSFER` (see [ADR 037](../../docs/adr/037-argon2id-context-profiles.md))

**Errors** — `CryptoError` (base), `DecryptionFailedError`, `KeysLockedError`, `SignatureVerificationError`, `CryptoNotReadyError`, `InvalidInputError`, `BiometricFailedError`, `AlreadyInitializedError`, `InvalidStateTransitionError`, `KeyStorageFailedError`, `UnsupportedOperationError`

### Sub-entry points

| Import path                          | Purpose                                                                           |
| ------------------------------------ | --------------------------------------------------------------------------------- |
| `@pluralscape/crypto/blob-pipeline`  | Encrypt/decrypt binary blobs with content validation and upload preparation       |
| `@pluralscape/crypto/wasm`           | WASM adapter (`WasmSodiumAdapter`) for Bun/Node/Web via `libsodium-wrappers-sumo` |
| `@pluralscape/crypto/react-native`   | React Native adapter (`ReactNativeSodiumAdapter`) via `react-native-libsodium`    |
| `@pluralscape/crypto/native-memzero` | `wrapNativeMemzero` — platform native secure memory zeroing                       |

## Usage

Initialize libsodium once before calling any crypto function:

```ts
import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";

configureSodium(new WasmSodiumAdapter());
await initSodium();
```

Generate a master key and encrypt data at T1 (zero-knowledge):

```ts
import { generateMasterKey, encryptTier1, decryptTier1 } from "@pluralscape/crypto";

const masterKey = generateMasterKey();

const blob = encryptTier1({ name: "Maple", role: "host" }, masterKey);
// blob.tier === 1 — safe to send to server

const plain = decryptTier1(blob, masterKey) as { name: string; role: string };
```

For Privacy Bucket sharing, generate a bucket key, encrypt data at T2, and distribute the bucket key as a key grant encrypted to each friend's public key:

```ts
import { generateBucketKey, encryptTier2, createKeyGrant } from "@pluralscape/crypto";

const bucketKey = generateBucketKey();
const blob = encryptTier2(data, { bucketKey, bucketId: "bucket-uuid" });

const grant = createKeyGrant({ bucketKey, bucketId: "bucket-uuid", recipientPublicKey });
// Store grant on server — recipient decrypts with their private key
```

## Dependencies

**Internal**

- `@pluralscape/types` — shared branded types (`BucketId`, `T1EncryptedBlob`, `T2EncryptedBlob`, etc.)

**External**

- `libsodium-wrappers-sumo` — WASM build of libsodium (Bun/Node/Web)
- `react-native-libsodium` _(optional peer dependency)_ — native libsodium bindings for React Native

## Testing

```bash
# Unit tests
pnpm vitest run --project crypto

# Integration tests
pnpm vitest run --project crypto-integration
```

Unit tests cover individual cryptographic operations (key derivation, encrypt/decrypt, signing, validation). Integration tests exercise the full key lifecycle, recovery flows, and device transfer protocol against real sodium operations. The suite also pins each primitive to its standard via known-answer tests — see `src/__tests__/test-vectors.test.ts` for X25519 (RFC 7748), Ed25519 (RFC 8032), Argon2 (RFC 9106), BLAKE2b (RFC 7693), and NIST/IETF vectors for XChaCha20-Poly1305 — so an accidental algorithm or parameter swap fails the suite rather than silently round-tripping.
