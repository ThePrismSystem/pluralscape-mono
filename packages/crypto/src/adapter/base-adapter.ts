/**
 * Abstract base class for sodium adapter implementations.
 *
 * Encapsulates the ~80% of methods that are identical across WASM and
 * React Native adapters. Subclasses provide platform-specific init(),
 * lib(), memzero(), and any methods with behavioural differences
 * (pwhashStr, pwhashStrVerify, signSeedKeypair).
 */

import { AEAD_NONCE_BYTES, SODIUM_CONSTANTS } from "../crypto.constants.js";
import { DecryptionFailedError } from "../errors.js";
import {
  assertAeadKey,
  assertAeadNonce,
  assertBoxNonce,
  assertBoxPublicKey,
  assertBoxSecretKey,
  assertBoxSeed,
  assertGenericHashLength,
  assertKdfContext,
  assertKdfMasterKey,
  assertKdfSubkeyLength,
  assertPwhashSalt,
  assertSignPublicKey,
  assertSignSecretKey,
  assertSignature,
} from "../validation.js";

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
import type { SodiumAdapter, SodiumConstants } from "./interface.js";

/**
 * Common subset of `libsodium-wrappers-sumo` and `react-native-libsodium`
 * for the methods used by BaseSodiumAdapter.
 *
 * Methods available only in WASM (e.g. `crypto_pwhash_str`, `crypto_sign_seed_keypair`,
 * `memzero`) are not included — subclasses access those via concrete types.
 */
export interface SodiumLib {
  readonly crypto_pwhash_ALG_ARGON2ID13: number;

  randombytes_buf(length: number): Uint8Array;

  crypto_aead_xchacha20poly1305_ietf_encrypt(
    message: Uint8Array,
    additionalData: Uint8Array | string | null,
    nsec: null,
    nonce: Uint8Array,
    key: Uint8Array,
  ): Uint8Array;

  crypto_aead_xchacha20poly1305_ietf_decrypt(
    nsec: null,
    ciphertext: Uint8Array,
    additionalData: Uint8Array | string | null,
    nonce: Uint8Array,
    key: Uint8Array,
  ): Uint8Array;

  crypto_aead_xchacha20poly1305_ietf_keygen(): Uint8Array;

  crypto_box_keypair(): { publicKey: Uint8Array; privateKey: Uint8Array };
  crypto_box_seed_keypair(seed: Uint8Array): { publicKey: Uint8Array; privateKey: Uint8Array };
  crypto_box_easy(
    message: Uint8Array,
    nonce: Uint8Array,
    publicKey: Uint8Array,
    secretKey: Uint8Array,
  ): Uint8Array;
  crypto_box_open_easy(
    ciphertext: Uint8Array,
    nonce: Uint8Array,
    publicKey: Uint8Array,
    secretKey: Uint8Array,
  ): Uint8Array;

  crypto_sign_keypair(): { publicKey: Uint8Array; privateKey: Uint8Array };
  crypto_sign_detached(message: Uint8Array, secretKey: Uint8Array): Uint8Array;
  crypto_sign_verify_detached(
    signature: Uint8Array,
    message: Uint8Array,
    publicKey: Uint8Array,
  ): boolean;

  crypto_pwhash(
    keyLength: number,
    password: Uint8Array,
    salt: Uint8Array,
    opsLimit: number,
    memLimit: number,
    algorithm: number,
  ): Uint8Array;

  crypto_kdf_derive_from_key(
    subkeyLength: number,
    subkeyId: number,
    context: string,
    key: Uint8Array,
  ): Uint8Array;
  crypto_kdf_keygen(): Uint8Array;

  crypto_generichash(
    hashLength: number,
    message: Uint8Array,
    key?: Uint8Array | string | null,
  ): Uint8Array;
}

/**
 * Abstract base class providing shared sodium operations.
 *
 * Subclasses must implement:
 * - `init()` — load and initialize the platform sodium library
 * - `lib()` — return the initialized sodium library (throw CryptoNotReadyError if not ready)
 * - `isReady()` — whether init() has completed
 * - `supportsSecureMemzero` — whether the platform supports secure memory zeroing
 * - `memzero()` — platform-specific secure memory zeroing
 * - `signSeedKeypair()` — RN throws UnsupportedOperationError
 * - `pwhashStr()` — WASM normalizes Uint8Array/string, RN throws
 * - `pwhashStrVerify()` — WASM delegates directly, RN throws
 */
export abstract class BaseSodiumAdapter implements SodiumAdapter {
  readonly constants: SodiumConstants = SODIUM_CONSTANTS;

  abstract readonly supportsSecureMemzero: boolean;

  abstract init(): Promise<void>;
  abstract isReady(): boolean;
  protected abstract lib(): SodiumLib;
  abstract memzero(buffer: Uint8Array): void;

  // These differ per-platform and must be overridden:
  abstract signSeedKeypair(seed: Uint8Array): SignKeypair;
  abstract pwhashStr(password: Uint8Array, opsLimit: number, memLimit: number): string;
  abstract pwhashStrVerify(hash: string, password: Uint8Array): boolean;

  // ── AEAD ──────────────────────────────────────────────────────────

  aeadEncrypt(plaintext: Uint8Array, additionalData: Uint8Array | null, key: AeadKey): AeadResult {
    assertAeadKey(key);
    const sodium = this.lib();
    const nonce = sodium.randombytes_buf(AEAD_NONCE_BYTES) as AeadNonce;
    const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      plaintext,
      additionalData,
      null, // nsec (unused in IETF variant)
      nonce,
      key,
    );
    return { ciphertext, nonce };
  }

  aeadDecrypt(
    ciphertext: Uint8Array,
    nonce: AeadNonce,
    additionalData: Uint8Array | null,
    key: AeadKey,
  ): Uint8Array {
    assertAeadNonce(nonce);
    assertAeadKey(key);
    const sodium = this.lib();
    try {
      return sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
        null, // nsec (unused in IETF variant)
        ciphertext,
        additionalData,
        nonce,
        key,
      );
    } catch (error: unknown) {
      throw new DecryptionFailedError(undefined, { cause: error });
    }
  }

  aeadKeygen(): AeadKey {
    const sodium = this.lib();
    return sodium.crypto_aead_xchacha20poly1305_ietf_keygen() as AeadKey;
  }

  // ── Box ───────────────────────────────────────────────────────────

  boxKeypair(): BoxKeypair {
    const sodium = this.lib();
    const kp = sodium.crypto_box_keypair();
    return { publicKey: kp.publicKey as BoxPublicKey, secretKey: kp.privateKey as BoxSecretKey };
  }

  boxSeedKeypair(seed: Uint8Array): BoxKeypair {
    assertBoxSeed(seed);
    const sodium = this.lib();
    const kp = sodium.crypto_box_seed_keypair(seed);
    return { publicKey: kp.publicKey as BoxPublicKey, secretKey: kp.privateKey as BoxSecretKey };
  }

  boxEasy(
    plaintext: Uint8Array,
    nonce: BoxNonce,
    recipientPublicKey: BoxPublicKey,
    senderSecretKey: BoxSecretKey,
  ): Uint8Array {
    assertBoxNonce(nonce);
    assertBoxPublicKey(recipientPublicKey);
    assertBoxSecretKey(senderSecretKey);
    const sodium = this.lib();
    return sodium.crypto_box_easy(plaintext, nonce, recipientPublicKey, senderSecretKey);
  }

  boxOpenEasy(
    ciphertext: Uint8Array,
    nonce: BoxNonce,
    senderPublicKey: BoxPublicKey,
    recipientSecretKey: BoxSecretKey,
  ): Uint8Array {
    assertBoxNonce(nonce);
    assertBoxPublicKey(senderPublicKey);
    assertBoxSecretKey(recipientSecretKey);
    const sodium = this.lib();
    try {
      return sodium.crypto_box_open_easy(ciphertext, nonce, senderPublicKey, recipientSecretKey);
    } catch (error: unknown) {
      throw new DecryptionFailedError(undefined, { cause: error });
    }
  }

  // ── Sign ──────────────────────────────────────────────────────────

  signKeypair(): SignKeypair {
    const sodium = this.lib();
    const kp = sodium.crypto_sign_keypair();
    return { publicKey: kp.publicKey as SignPublicKey, secretKey: kp.privateKey as SignSecretKey };
  }

  signDetached(message: Uint8Array, secretKey: SignSecretKey): Signature {
    assertSignSecretKey(secretKey);
    const sodium = this.lib();
    return sodium.crypto_sign_detached(message, secretKey) as Signature;
  }

  signVerifyDetached(signature: Signature, message: Uint8Array, publicKey: SignPublicKey): boolean {
    assertSignature(signature);
    assertSignPublicKey(publicKey);
    const sodium = this.lib();
    try {
      return sodium.crypto_sign_verify_detached(signature, message, publicKey);
    } catch (error: unknown) {
      // After input validation, any Error from libsodium indicates an invalid
      // signature. Non-Error exceptions (system failures) are rethrown.
      if (error instanceof Error) {
        return false;
      }
      throw error;
    }
  }

  // ── Pwhash ────────────────────────────────────────────────────────

  pwhash(
    keyLength: number,
    password: Uint8Array,
    salt: Uint8Array,
    opsLimit: number,
    memLimit: number,
  ): Uint8Array {
    assertPwhashSalt(salt);
    const sodium = this.lib();
    return sodium.crypto_pwhash(
      keyLength,
      password,
      salt,
      opsLimit,
      memLimit,
      sodium.crypto_pwhash_ALG_ARGON2ID13,
    );
  }

  // ── KDF ───────────────────────────────────────────────────────────

  kdfDeriveFromKey(
    subkeyLength: number,
    subkeyId: number,
    context: string,
    masterKey: KdfMasterKey,
  ): Uint8Array {
    assertKdfSubkeyLength(subkeyLength);
    assertKdfContext(context);
    assertKdfMasterKey(masterKey);
    const sodium = this.lib();
    return sodium.crypto_kdf_derive_from_key(subkeyLength, subkeyId, context, masterKey);
  }

  kdfKeygen(): KdfMasterKey {
    const sodium = this.lib();
    return sodium.crypto_kdf_keygen() as KdfMasterKey;
  }

  // ── Generic Hash (BLAKE2b) ────────────────────────────────────────

  genericHash(hashLength: number, message: Uint8Array, key?: Uint8Array | null): Uint8Array {
    assertGenericHashLength(hashLength);
    const sodium = this.lib();
    return sodium.crypto_generichash(hashLength, message, key ?? null);
  }

  // ── Random ────────────────────────────────────────────────────────

  randomBytes(length: number): Uint8Array {
    const sodium = this.lib();
    return sodium.randombytes_buf(length);
  }
}
