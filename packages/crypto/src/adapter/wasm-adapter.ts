import {
  AEAD_KEY_BYTES,
  AEAD_NONCE_BYTES,
  AEAD_TAG_BYTES,
  BOX_MAC_BYTES,
  BOX_NONCE_BYTES,
  BOX_PUBLIC_KEY_BYTES,
  BOX_SECRET_KEY_BYTES,
  BOX_SEED_BYTES,
  KDF_BYTES_MAX,
  KDF_BYTES_MIN,
  KDF_CONTEXT_BYTES,
  KDF_KEY_BYTES,
  PWHASH_MEMLIMIT_INTERACTIVE,
  PWHASH_MEMLIMIT_MODERATE,
  PWHASH_OPSLIMIT_INTERACTIVE,
  PWHASH_OPSLIMIT_MODERATE,
  PWHASH_SALT_BYTES,
  SIGN_BYTES,
  SIGN_PUBLIC_KEY_BYTES,
  SIGN_SECRET_KEY_BYTES,
  SIGN_SEED_BYTES,
} from "../constants.js";
import { DecryptionFailedError } from "../errors.js";

import type { AeadResult, CryptoKeypair } from "../types.js";
import type { SodiumAdapter, SodiumConstants } from "./interface.js";
import type libsodiumSumo from "libsodium-wrappers-sumo";

/**
 * SodiumAdapter implementation using libsodium-wrappers-sumo (WASM).
 * Works in Bun, Node.js, and web browsers.
 */
export class WasmSodiumAdapter implements SodiumAdapter {
  private sodium: typeof libsodiumSumo | null = null;

  readonly constants: SodiumConstants = {
    AEAD_KEY_BYTES,
    AEAD_NONCE_BYTES,
    AEAD_TAG_BYTES,
    BOX_PUBLIC_KEY_BYTES,
    BOX_SECRET_KEY_BYTES,
    BOX_NONCE_BYTES,
    BOX_MAC_BYTES,
    BOX_SEED_BYTES,
    SIGN_PUBLIC_KEY_BYTES,
    SIGN_SECRET_KEY_BYTES,
    SIGN_BYTES,
    SIGN_SEED_BYTES,
    PWHASH_SALT_BYTES,
    PWHASH_OPSLIMIT_INTERACTIVE,
    PWHASH_MEMLIMIT_INTERACTIVE,
    PWHASH_OPSLIMIT_MODERATE,
    PWHASH_MEMLIMIT_MODERATE,
    KDF_KEY_BYTES,
    KDF_CONTEXT_BYTES,
    KDF_BYTES_MIN,
    KDF_BYTES_MAX,
  };

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
      throw new Error("WasmSodiumAdapter not initialized. Call init() first.");
    }
    return this.sodium;
  }

  // ── AEAD ──────────────────────────────────────────────────────────

  aeadEncrypt(
    plaintext: Uint8Array,
    additionalData: Uint8Array | null,
    key: Uint8Array,
  ): AeadResult {
    const sodium = this.lib();
    const nonce = sodium.randombytes_buf(AEAD_NONCE_BYTES);
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
    nonce: Uint8Array,
    additionalData: Uint8Array | null,
    key: Uint8Array,
  ): Uint8Array {
    const sodium = this.lib();
    try {
      return sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
        null, // nsec (unused in IETF variant)
        ciphertext,
        additionalData,
        nonce,
        key,
      );
    } catch {
      throw new DecryptionFailedError();
    }
  }

  aeadKeygen(): Uint8Array {
    const sodium = this.lib();
    return sodium.crypto_aead_xchacha20poly1305_ietf_keygen();
  }

  // ── Box ───────────────────────────────────────────────────────────

  boxKeypair(): CryptoKeypair {
    const sodium = this.lib();
    const kp = sodium.crypto_box_keypair();
    return { publicKey: kp.publicKey, secretKey: kp.privateKey };
  }

  boxSeedKeypair(seed: Uint8Array): CryptoKeypair {
    const sodium = this.lib();
    const kp = sodium.crypto_box_seed_keypair(seed);
    return { publicKey: kp.publicKey, secretKey: kp.privateKey };
  }

  boxEasy(
    plaintext: Uint8Array,
    nonce: Uint8Array,
    recipientPublicKey: Uint8Array,
    senderSecretKey: Uint8Array,
  ): Uint8Array {
    const sodium = this.lib();
    return sodium.crypto_box_easy(plaintext, nonce, recipientPublicKey, senderSecretKey);
  }

  boxOpenEasy(
    ciphertext: Uint8Array,
    nonce: Uint8Array,
    senderPublicKey: Uint8Array,
    recipientSecretKey: Uint8Array,
  ): Uint8Array {
    const sodium = this.lib();
    try {
      return sodium.crypto_box_open_easy(ciphertext, nonce, senderPublicKey, recipientSecretKey);
    } catch {
      throw new DecryptionFailedError();
    }
  }

  // ── Sign ──────────────────────────────────────────────────────────

  signKeypair(): CryptoKeypair {
    const sodium = this.lib();
    const kp = sodium.crypto_sign_keypair();
    return { publicKey: kp.publicKey, secretKey: kp.privateKey };
  }

  signSeedKeypair(seed: Uint8Array): CryptoKeypair {
    const sodium = this.lib();
    const kp = sodium.crypto_sign_seed_keypair(seed);
    return { publicKey: kp.publicKey, secretKey: kp.privateKey };
  }

  signDetached(message: Uint8Array, secretKey: Uint8Array): Uint8Array {
    const sodium = this.lib();
    return sodium.crypto_sign_detached(message, secretKey);
  }

  signVerifyDetached(signature: Uint8Array, message: Uint8Array, publicKey: Uint8Array): boolean {
    const sodium = this.lib();
    return sodium.crypto_sign_verify_detached(signature, message, publicKey);
  }

  // ── Pwhash ────────────────────────────────────────────────────────

  pwhash(
    keyLength: number,
    password: Uint8Array,
    salt: Uint8Array,
    opsLimit: number,
    memLimit: number,
  ): Uint8Array {
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
    masterKey: Uint8Array,
  ): Uint8Array {
    const sodium = this.lib();
    return sodium.crypto_kdf_derive_from_key(subkeyLength, subkeyId, context, masterKey);
  }

  kdfKeygen(): Uint8Array {
    const sodium = this.lib();
    return sodium.crypto_kdf_keygen();
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
