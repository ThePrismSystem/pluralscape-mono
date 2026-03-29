import {
  AEAD_KEY_BYTES,
  AEAD_NONCE_BYTES,
  assertAeadKey,
  assertAeadNonce,
  getSodium,
} from "@pluralscape/crypto";

import { env } from "../env.js";

import { assertBasicEmailFormat } from "./email-format.js";
import { fromHex } from "./hex.js";

import type { AeadKey } from "@pluralscape/crypto";

/** Expected hex length for a 32-byte AEAD key. */
const ENCRYPTION_KEY_HEX_LENGTH = AEAD_KEY_BYTES * 2;

/**
 * Get the server-held email encryption key from the environment.
 * Returns null if the key is not configured (development/testing).
 */
export function getEmailEncryptionKey(): AeadKey | null {
  const hex = env.EMAIL_ENCRYPTION_KEY;
  if (!hex) {
    return null;
  }
  if (hex.length !== ENCRYPTION_KEY_HEX_LENGTH) {
    throw new Error(
      `EMAIL_ENCRYPTION_KEY must be a ${String(ENCRYPTION_KEY_HEX_LENGTH)}-character hex string (${String(AEAD_KEY_BYTES)} bytes).`,
    );
  }
  const key = fromHex(hex);
  assertAeadKey(key);
  return key;
}

/**
 * Encrypt an email address using XChaCha20-Poly1305 with the server-held key.
 * Returns the combined nonce + ciphertext as a Uint8Array suitable for bytea storage.
 *
 * The email is normalized (lowercase + trim) before encryption to ensure
 * consistent round-trip behavior.
 *
 * @throws {Error} if EMAIL_ENCRYPTION_KEY is not configured
 */
export function encryptEmail(email: string): Uint8Array {
  assertBasicEmailFormat(email);
  const key = getEmailEncryptionKey();
  if (!key) {
    throw new Error("EMAIL_ENCRYPTION_KEY is required for email encryption but not configured.");
  }

  try {
    const adapter = getSodium();
    const normalized = email.toLowerCase().trim();
    const plaintext = new TextEncoder().encode(normalized);

    const result = adapter.aeadEncrypt(plaintext, null, key);

    // Combine nonce + ciphertext for storage
    const combined = new Uint8Array(AEAD_NONCE_BYTES + result.ciphertext.length);
    combined.set(result.nonce, 0);
    combined.set(result.ciphertext, AEAD_NONCE_BYTES);

    return combined;
  } finally {
    getSodium().memzero(key);
  }
}

/**
 * Decrypt an email address from its encrypted storage form.
 * Expects the combined nonce + ciphertext format produced by encryptEmail.
 *
 * @throws {Error} if EMAIL_ENCRYPTION_KEY is not configured
 * @throws {Error} if decryption fails (wrong key, corrupted data)
 */
export function decryptEmail(encrypted: Uint8Array): string {
  const key = getEmailEncryptionKey();
  if (!key) {
    throw new Error("EMAIL_ENCRYPTION_KEY is required for email decryption but not configured.");
  }

  if (encrypted.length <= AEAD_NONCE_BYTES) {
    throw new Error("Encrypted email data is too short to contain a valid nonce and ciphertext.");
  }

  try {
    const adapter = getSodium();
    const nonce = encrypted.slice(0, AEAD_NONCE_BYTES);
    const ciphertext = encrypted.slice(AEAD_NONCE_BYTES);

    assertAeadNonce(nonce);
    const plaintext = adapter.aeadDecrypt(ciphertext, nonce, null, key);

    return new TextDecoder().decode(plaintext);
  } finally {
    getSodium().memzero(key);
  }
}
