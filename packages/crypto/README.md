# @pluralscape/crypto

Client-side encryption layer for Pluralscape — libsodium primitives, key hierarchy, and E2E encryption pipeline.

## Overview

Pluralscape enforces zero-knowledge encryption: the server never sees plaintext user data. This package implements the full client-side cryptographic stack using [libsodium](https://libsodium.org/) (XChaCha20-Poly1305 for symmetric encryption, X25519 for asymmetric, Ed25519 for signing, Argon2id for key derivation). All encryption and decryption happens on the device before any data leaves or arrives from the server.

Data is encrypted at one of three tiers based on its sensitivity and sharing requirements. **T1** (zero-knowledge) encrypts with a sub-key derived from the system master key — only the account owner can decrypt. **T2** (per-bucket) encrypts with a per-Privacy-Bucket symmetric key distributed asymmetrically to authorized friends — enabling selective sharing without the server ever seeing the bucket key. **T3** is a typed passthrough for non-sensitive metadata fields that remain in plaintext. See [ADR 006](../../docs/adr/006-encryption.md) for the full encryption architecture.

The key hierarchy flows from a user password through Argon2id to a 256-bit master key, then to identity keypairs (X25519 + Ed25519, independently derived via BLAKE2B KDF) and per-bucket symmetric keys. Key recovery uses a generated recovery phrase that re-encrypts the master key independently of the password. Device transfer uses a QR-scanned ephemeral key to securely bootstrap a new device without a server round-trip. See [ADR 011](../../docs/adr/011-key-recovery.md) and [ADR 014](../../docs/adr/014-lazy-key-rotation.md) for recovery and rotation details.

## Key Exports

### Main entry (`@pluralscape/crypto`)

**Sodium lifecycle** — `initSodium`, `configureSodium`, `getSodium`, `isReady`

**Key derivation** — `deriveMasterKey`, `generateSalt`, `derivePasswordKey`, `generateMasterKey`, `wrapMasterKey`, `unwrapMasterKey`, `deriveSyncEncryptionKey`

**Symmetric encryption** — `encrypt`, `decrypt`, `encryptJSON`, `decryptJSON`, `encryptStream`, `decryptStream`

**Tier helpers** — `encryptTier1`, `decryptTier1`, `encryptTier1Batch`, `decryptTier1Batch`, `encryptTier2`, `decryptTier2`, `encryptTier2Batch`, `decryptTier2Batch`, `wrapTier3`

**Identity keypairs** — `generateIdentityKeypair`, `encryptPrivateKey`, `decryptPrivateKey`, `serializePublicKey`

**Bucket key management** — `generateBucketKey`, `encryptBucketKey`, `decryptBucketKey`, `rotateBucketKey`, `createBucketKeyCache`

**Key grants** — `createKeyGrant`, `createKeyGrants`, `decryptKeyGrant`

**Recovery and transfer** — `generateRecoveryKey`, `recoverMasterKey`, `isValidRecoveryKeyFormat`, `toRecoveryKeyDisplay`, `serializeRecoveryBackup`, `deserializeRecoveryBackup`, `resetPasswordViaRecoveryKey`, `regenerateRecoveryKey`, `generateTransferCode`, `deriveTransferKey`, `encryptForTransfer`, `decryptFromTransfer`, `encodeQRPayload`, `decodeQRPayload`

**Signing** — `sign`, `verify`, `signThenEncrypt`, `decryptThenVerify`

**Safety numbers** — `computeSafetyNumber`

**Password / PIN** — `hashPassword`, `verifyPassword`, `hashPin`, `verifyPin`

**Key storage** — `createWebKeyStorage`

**Key lifecycle** — `MobileKeyLifecycleManager`, `SECURITY_PRESETS`

**Validation** — `assertAeadKey`, `assertAeadNonce`, `assertBufferLength`, `assertPwhashSalt`, `assertSignature`, `assertSignPublicKey`

**Hex encoding** — `toHex`, `fromHex`

**Blob codec** — `serializeEncryptedBlob`, `deserializeEncryptedBlob`

**Errors** — `DecryptionFailedError`, `KeysLockedError`, `SignatureVerificationError`, `CryptoNotReadyError`, `InvalidInputError`, `BiometricFailedError`, `AlreadyInitializedError`, `InvalidStateTransitionError`, `KeyStorageFailedError`, `UnsupportedOperationError`

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

Derive a master key from a password and encrypt data at T1 (zero-knowledge):

```ts
import { deriveMasterKey, encryptTier1, decryptTier1, generateSalt } from "@pluralscape/crypto";

const salt = generateSalt();
const masterKey = await deriveMasterKey({ password: "hunter2", salt });

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

Unit tests cover individual cryptographic operations (key derivation, encrypt/decrypt, signing, validation). Integration tests exercise the full key lifecycle, recovery flows, and device transfer protocol against real sodium operations.
