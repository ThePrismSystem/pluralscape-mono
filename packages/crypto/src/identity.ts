import { KDF_KEY_BYTES } from "./crypto.constants.js";
import { getSodium } from "./sodium.js";
import { decrypt, encrypt } from "./symmetric.js";

import type {
  AeadKey,
  AeadNonce,
  BoxKeypair,
  BoxPublicKey,
  KdfMasterKey,
  SignKeypair,
  SignPublicKey,
} from "./types.js";

/** Identity keypair: X25519 for encryption + Ed25519 for signing. */
export interface IdentityKeypair {
  readonly encryption: BoxKeypair;
  readonly signing: SignKeypair;
}

/** An encrypted private key blob with nonce for storage. */
export interface EncryptedPrivateKey {
  readonly ciphertext: Uint8Array;
  readonly nonce: AeadNonce;
}

/** KDF sub-key IDs for identity derivation. */
const SUBKEY_ENCRYPTION = 1;
const SUBKEY_SIGNING = 2;
const SUBKEY_PRIVATE_KEY_ENCRYPTION = 3;
const KDF_CONTEXT = "identity";

/**
 * Generate identity keypairs deterministically from a master key.
 * Derives X25519 (subkey 1) and Ed25519 (subkey 2) from the "identity" context.
 *
 * WASM-only: `signSeedKeypair` is not available on React Native.
 * The RN-specific KeyLifecycleManager (crypto-inca) handles this differently.
 */
export function generateIdentityKeypair(masterKey: KdfMasterKey): IdentityKeypair {
  const adapter = getSodium();

  const encSeed = adapter.kdfDeriveFromKey(
    KDF_KEY_BYTES,
    SUBKEY_ENCRYPTION,
    KDF_CONTEXT,
    masterKey,
  );
  const signSeed = adapter.kdfDeriveFromKey(KDF_KEY_BYTES, SUBKEY_SIGNING, KDF_CONTEXT, masterKey);

  try {
    const encryption = adapter.boxSeedKeypair(encSeed);
    const signing = adapter.signSeedKeypair(signSeed);
    return { encryption, signing };
  } finally {
    adapter.memzero(encSeed);
    adapter.memzero(signSeed);
  }
}

/**
 * Encrypt a private key for server storage.
 * Derives a sub-key (subkey 3, "identity" context) from the master key.
 */
export function encryptPrivateKey(
  privateKey: Uint8Array,
  masterKey: KdfMasterKey,
): EncryptedPrivateKey {
  const adapter = getSodium();
  const derivedKey = adapter.kdfDeriveFromKey(
    KDF_KEY_BYTES,
    SUBKEY_PRIVATE_KEY_ENCRYPTION,
    KDF_CONTEXT,
    masterKey,
  );
  try {
    const result = encrypt(privateKey, derivedKey as AeadKey);
    return { ciphertext: result.ciphertext, nonce: result.nonce };
  } finally {
    adapter.memzero(derivedKey);
  }
}

/** Decrypt a private key blob using the master key. */
export function decryptPrivateKey(blob: EncryptedPrivateKey, masterKey: KdfMasterKey): Uint8Array {
  const adapter = getSodium();
  const derivedKey = adapter.kdfDeriveFromKey(
    KDF_KEY_BYTES,
    SUBKEY_PRIVATE_KEY_ENCRYPTION,
    KDF_CONTEXT,
    masterKey,
  );
  try {
    return decrypt({ ciphertext: blob.ciphertext, nonce: blob.nonce }, derivedKey as AeadKey);
  } finally {
    adapter.memzero(derivedKey);
  }
}

// Base64url alphabet (RFC 4648 section 5)
const BASE64URL_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const B64_MASK = 0x3f;
const B64_SHIFT_4 = 4;
const B64_SHIFT_2 = 2;
const B64_SHIFT_6 = 6;
const B64_GROUP_SIZE = 3;

/** Serialize a public key to base64url (no padding) for server/directory storage. */
export function serializePublicKey(key: BoxPublicKey | SignPublicKey): string {
  let result = "";
  for (let i = 0; i < key.length; i += B64_GROUP_SIZE) {
    const b0 = key[i] ?? 0;
    const b1 = i + 1 < key.length ? (key[i + 1] ?? 0) : 0;
    const b2 = i + 2 < key.length ? (key[i + 2] ?? 0) : 0;
    result += BASE64URL_CHARS[(b0 >> B64_SHIFT_2) & B64_MASK] ?? "";
    result += BASE64URL_CHARS[((b0 << B64_SHIFT_4) | (b1 >> B64_SHIFT_4)) & B64_MASK] ?? "";
    if (i + 1 < key.length) {
      result += BASE64URL_CHARS[((b1 << B64_SHIFT_2) | (b2 >> B64_SHIFT_6)) & B64_MASK] ?? "";
    }
    if (i + 2 < key.length) {
      result += BASE64URL_CHARS[b2 & B64_MASK] ?? "";
    }
  }
  return result;
}
