import type { AeadResult, CryptoKeypair } from "../types.js";

/**
 * Constant values exposed by a sodium adapter.
 * Must match the libsodium C library specifications.
 */
export interface SodiumConstants {
  readonly AEAD_KEY_BYTES: number;
  readonly AEAD_NONCE_BYTES: number;
  readonly AEAD_TAG_BYTES: number;

  readonly BOX_PUBLIC_KEY_BYTES: number;
  readonly BOX_SECRET_KEY_BYTES: number;
  readonly BOX_NONCE_BYTES: number;
  readonly BOX_MAC_BYTES: number;
  readonly BOX_SEED_BYTES: number;

  readonly SIGN_PUBLIC_KEY_BYTES: number;
  readonly SIGN_SECRET_KEY_BYTES: number;
  readonly SIGN_BYTES: number;
  readonly SIGN_SEED_BYTES: number;

  readonly PWHASH_SALT_BYTES: number;
  readonly PWHASH_OPSLIMIT_INTERACTIVE: number;
  readonly PWHASH_MEMLIMIT_INTERACTIVE: number;
  readonly PWHASH_OPSLIMIT_MODERATE: number;
  readonly PWHASH_MEMLIMIT_MODERATE: number;

  readonly KDF_KEY_BYTES: number;
  readonly KDF_CONTEXT_BYTES: number;
  readonly KDF_BYTES_MIN: number;
  readonly KDF_BYTES_MAX: number;
}

/**
 * Platform-agnostic interface for libsodium operations.
 *
 * Mirrors libsodium's native parameter signatures. Higher-level ergonomic
 * wrappers (auto-nonce generation, branded types) are downstream tasks.
 *
 * Implementations:
 * - WasmSodiumAdapter: libsodium-wrappers-sumo (Bun/Node/Web)
 * - ReactNativeSodiumAdapter: react-native-libsodium (React Native)
 */
export interface SodiumAdapter {
  /** Initialize the adapter. Must be called before any other method. */
  init(): Promise<void>;

  /** Whether `init()` has completed successfully. */
  isReady(): boolean;

  /** Constant values from the underlying library. */
  readonly constants: SodiumConstants;

  // ── AEAD (XChaCha20-Poly1305 IETF) ────────────────────────────────

  /** Encrypt plaintext with AEAD. Generates a random nonce. */
  aeadEncrypt(
    plaintext: Uint8Array,
    additionalData: Uint8Array | null,
    key: Uint8Array,
  ): AeadResult;

  /** Decrypt AEAD ciphertext. Throws DecryptionFailedError on failure. */
  aeadDecrypt(
    ciphertext: Uint8Array,
    nonce: Uint8Array,
    additionalData: Uint8Array | null,
    key: Uint8Array,
  ): Uint8Array;

  /** Generate a random AEAD key. */
  aeadKeygen(): Uint8Array;

  // ── Box (X25519 + XSalsa20-Poly1305) ──────────────────────────────

  /** Generate a random X25519 keypair. */
  boxKeypair(): CryptoKeypair;

  /** Derive an X25519 keypair from a 32-byte seed. */
  boxSeedKeypair(seed: Uint8Array): CryptoKeypair;

  /** Encrypt a message for a recipient using their public key. */
  boxEasy(
    plaintext: Uint8Array,
    nonce: Uint8Array,
    recipientPublicKey: Uint8Array,
    senderSecretKey: Uint8Array,
  ): Uint8Array;

  /** Decrypt a box ciphertext. Throws DecryptionFailedError on failure. */
  boxOpenEasy(
    ciphertext: Uint8Array,
    nonce: Uint8Array,
    senderPublicKey: Uint8Array,
    recipientSecretKey: Uint8Array,
  ): Uint8Array;

  // ── Sign (Ed25519) ────────────────────────────────────────────────

  /** Generate a random Ed25519 keypair. */
  signKeypair(): CryptoKeypair;

  /**
   * Derive an Ed25519 keypair from a 32-byte seed.
   * Not available on React Native — throws UnsupportedOperationError.
   */
  signSeedKeypair(seed: Uint8Array): CryptoKeypair;

  /** Create a detached Ed25519 signature. */
  signDetached(message: Uint8Array, secretKey: Uint8Array): Uint8Array;

  /** Verify a detached Ed25519 signature. Returns true if valid. */
  signVerifyDetached(signature: Uint8Array, message: Uint8Array, publicKey: Uint8Array): boolean;

  // ── Password Hashing (Argon2id) ───────────────────────────────────

  /** Derive a key from a password using Argon2id. */
  pwhash(
    keyLength: number,
    password: Uint8Array,
    salt: Uint8Array,
    opsLimit: number,
    memLimit: number,
  ): Uint8Array;

  // ── KDF (BLAKE2B) ────────────────────────────────────────────────

  /** Derive a sub-key from a master key using BLAKE2B. */
  kdfDeriveFromKey(
    subkeyLength: number,
    subkeyId: number,
    context: string,
    masterKey: Uint8Array,
  ): Uint8Array;

  /** Generate a random KDF master key. */
  kdfKeygen(): Uint8Array;

  // ── Random ────────────────────────────────────────────────────────

  /** Generate cryptographically secure random bytes. */
  randomBytes(length: number): Uint8Array;

  // ── Memory ────────────────────────────────────────────────────────

  /** Zero out a buffer. Best-effort on platforms without secure memzero. */
  memzero(buffer: Uint8Array): void;
}
