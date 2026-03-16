/**
 * SodiumAdapter implementation using react-native-libsodium (JSI bindings).
 *
 * Known gaps (react-native-libsodium does not support):
 * - crypto_sign_seed_keypair — signSeedKeypair() throws UnsupportedOperationError
 * - memzero — polyfilled with Uint8Array.fill(0) unless NativeMemzero is provided
 *   via constructor for cryptographically secure zeroing (iOS memset_s, Android volatile loop)
 *
 * The missing ed25519-to-curve25519 conversion functions are not needed:
 * ADR 006 addendum specifies independent key derivation via KDF instead.
 *
 * @see https://github.com/nicolo-ribaudo/react-native-libsodium
 */
import { AEAD_NONCE_BYTES, SODIUM_CONSTANTS } from "../crypto.constants.js";
import {
  CryptoNotReadyError,
  DecryptionFailedError,
  UnsupportedOperationError,
} from "../errors.js";
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

import type { NativeMemzero } from "../lifecycle-types.js";
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

// react-native-libsodium is a peer dependency — only available in RN environments
type RNSodium = typeof import("react-native-libsodium");

export class ReactNativeSodiumAdapter implements SodiumAdapter {
  private sodium: RNSodium | null = null;
  private readonly nativeMemzero: NativeMemzero | undefined;

  readonly constants: SodiumConstants = SODIUM_CONSTANTS;

  get supportsSecureMemzero(): boolean {
    return this.nativeMemzero !== undefined;
  }

  constructor(nativeMemzero?: NativeMemzero) {
    this.nativeMemzero = nativeMemzero;
  }

  async init(): Promise<void> {
    if (this.sodium !== null) {
      return;
    }
    // Dynamic import — react-native-libsodium must be installed in the RN app
    const rnSodium: RNSodium = await import("react-native-libsodium");
    // Sumo version needed for crypto_pwhash
    await rnSodium.loadSumoVersion();
    await rnSodium.ready;
    this.sodium = rnSodium;
  }

  isReady(): boolean {
    return this.sodium !== null;
  }

  private lib(): RNSodium {
    if (this.sodium === null) {
      throw new CryptoNotReadyError("ReactNativeSodiumAdapter not initialized. Call init() first.");
    }
    return this.sodium;
  }

  // ── AEAD ──────────────────────────────────────────────────────────

  aeadEncrypt(plaintext: Uint8Array, additionalData: Uint8Array | null, key: AeadKey): AeadResult {
    assertAeadKey(key);
    const sodium = this.lib();
    const nonce = sodium.randombytes_buf(AEAD_NONCE_BYTES) as AeadNonce;
    const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      plaintext,
      additionalData,
      null,
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
        null,
        ciphertext,
        additionalData,
        nonce,
        key,
      );
    } catch (error) {
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
    } catch (error) {
      throw new DecryptionFailedError(undefined, { cause: error });
    }
  }

  // ── Sign ──────────────────────────────────────────────────────────

  signKeypair(): SignKeypair {
    const sodium = this.lib();
    const kp = sodium.crypto_sign_keypair();
    return { publicKey: kp.publicKey as SignPublicKey, secretKey: kp.privateKey as SignSecretKey };
  }

  /**
   * Not supported on React Native — react-native-libsodium does not expose
   * crypto_sign_seed_keypair. Use KDF to derive seed material and store the
   * full keypair instead.
   */
  signSeedKeypair(): SignKeypair {
    throw new UnsupportedOperationError("signSeedKeypair", "react-native");
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
      // After input validation, libsodium throws Error for invalid signatures.
      // Rethrow non-Error exceptions to avoid swallowing system failures.
      if (error instanceof Error && error.message.includes("incorrect signature")) {
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

  // ── Memory ────────────────────────────────────────────────────────

  /**
   * Secure memzero when NativeMemzero is provided; best-effort polyfill otherwise.
   *
   * Without NativeMemzero, uses Uint8Array.fill(0) which may be optimized away
   * by Hermes. Provide a NativeMemzero via the constructor for cryptographically
   * secure zeroing backed by platform-native APIs.
   */
  memzero(buffer: Uint8Array): void {
    if (this.nativeMemzero !== undefined) {
      this.nativeMemzero.memzero(buffer);
    } else {
      buffer.fill(0);
    }
  }
}
