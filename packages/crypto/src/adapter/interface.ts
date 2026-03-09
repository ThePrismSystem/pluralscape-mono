import type { SODIUM_CONSTANTS } from "../constants.js";
import type {
  AeadKey,
  AeadNonce,
  AeadResult,
  BoxKeypair,
  BoxNonce,
  BoxPublicKey,
  BoxSecretKey,
  KdfMasterKey,
  Signature,
  SignKeypair,
  SignPublicKey,
  SignSecretKey,
} from "../types.js";

/** Constant values exposed by a sodium adapter. */
export type SodiumConstants = typeof SODIUM_CONSTANTS;

/**
 * Platform-agnostic interface for libsodium operations.
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

  /** Whether the adapter uses cryptographically secure memzero. */
  readonly supportsSecureMemzero: boolean;

  // ── AEAD (XChaCha20-Poly1305 IETF) ────────────────────────────────

  /** Encrypt plaintext with AEAD. Generates a random nonce. */
  aeadEncrypt(plaintext: Uint8Array, additionalData: Uint8Array | null, key: AeadKey): AeadResult;

  /** Decrypt AEAD ciphertext. Throws DecryptionFailedError on failure. */
  aeadDecrypt(
    ciphertext: Uint8Array,
    nonce: AeadNonce,
    additionalData: Uint8Array | null,
    key: AeadKey,
  ): Uint8Array;

  /** Generate a random AEAD key. */
  aeadKeygen(): AeadKey;

  // ── Box (X25519 + XSalsa20-Poly1305) ──────────────────────────────

  /** Generate a random X25519 keypair. */
  boxKeypair(): BoxKeypair;

  /** Derive an X25519 keypair from a 32-byte seed. */
  boxSeedKeypair(seed: Uint8Array): BoxKeypair;

  /** Encrypt a message for a recipient using their public key. */
  boxEasy(
    plaintext: Uint8Array,
    nonce: BoxNonce,
    recipientPublicKey: BoxPublicKey,
    senderSecretKey: BoxSecretKey,
  ): Uint8Array;

  /** Decrypt a box ciphertext. Throws DecryptionFailedError on failure. */
  boxOpenEasy(
    ciphertext: Uint8Array,
    nonce: BoxNonce,
    senderPublicKey: BoxPublicKey,
    recipientSecretKey: BoxSecretKey,
  ): Uint8Array;

  // ── Sign (Ed25519) ────────────────────────────────────────────────

  /** Generate a random Ed25519 keypair. */
  signKeypair(): SignKeypair;

  /**
   * Derive an Ed25519 keypair from a 32-byte seed.
   * Not available on React Native — throws UnsupportedOperationError.
   */
  signSeedKeypair(seed: Uint8Array): SignKeypair;

  /** Create a detached Ed25519 signature. */
  signDetached(message: Uint8Array, secretKey: SignSecretKey): Signature;

  /** Verify a detached Ed25519 signature. Returns true if valid. */
  signVerifyDetached(signature: Signature, message: Uint8Array, publicKey: SignPublicKey): boolean;

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
    masterKey: KdfMasterKey,
  ): Uint8Array;

  /** Generate a random KDF master key. */
  kdfKeygen(): KdfMasterKey;

  // ── Random ────────────────────────────────────────────────────────

  /** Generate cryptographically secure random bytes. */
  randomBytes(length: number): Uint8Array;

  // ── Memory ────────────────────────────────────────────────────────

  /** Zero out a buffer. Best-effort on platforms without secure memzero. */
  memzero(buffer: Uint8Array): void;
}
