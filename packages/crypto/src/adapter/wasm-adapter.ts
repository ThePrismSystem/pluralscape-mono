import { AEAD_NONCE_BYTES, SODIUM_CONSTANTS } from "../crypto.constants.js";
import { CryptoNotReadyError, DecryptionFailedError } from "../errors.js";
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
  assertSignSeed,
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
import type libsodiumSumo from "libsodium-wrappers-sumo";

/**
 * SodiumAdapter implementation using libsodium-wrappers-sumo (WASM).
 * Works in Bun, Node.js, and web browsers.
 */
export class WasmSodiumAdapter implements SodiumAdapter {
  private sodium: typeof libsodiumSumo | null = null;

  readonly constants: SodiumConstants = SODIUM_CONSTANTS;
  readonly supportsSecureMemzero = true;

  async init(): Promise<void> {
    if (this.sodium !== null) {
      return;
    }
    const sodiumModule = await import("libsodium-wrappers-sumo");
    const sodium = sodiumModule.default;
    await sodium.ready;
    this.sodium = sodium;
  }

  isReady(): boolean {
    return this.sodium !== null;
  }

  private lib(): typeof libsodiumSumo {
    if (this.sodium === null) {
      throw new CryptoNotReadyError("WasmSodiumAdapter not initialized. Call init() first.");
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

  signSeedKeypair(seed: Uint8Array): SignKeypair {
    assertSignSeed(seed);
    const sodium = this.lib();
    const kp = sodium.crypto_sign_seed_keypair(seed);
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

  pwhashStr(password: Uint8Array, opsLimit: number, memLimit: number): string {
    const sodium = this.lib();
    // Type defs report Uint8Array but runtime returns a null-terminated ASCII string.
    // Handle both cases: decode Uint8Array or strip null terminator from string.
    const result: Uint8Array | string = sodium.crypto_pwhash_str(password, opsLimit, memLimit) as
      | Uint8Array
      | string;
    if (typeof result === "string") {
      return result.replace(/\0+$/, "");
    }
    return new TextDecoder().decode(result).replace(/\0+$/, "");
  }

  pwhashStrVerify(hash: string, password: Uint8Array): boolean {
    const sodium = this.lib();
    return sodium.crypto_pwhash_str_verify(hash, password);
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

  memzero(buffer: Uint8Array): void {
    const sodium = this.lib();
    sodium.memzero(buffer);
  }
}
