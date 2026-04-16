import {
  AEAD_KEY_BYTES,
  AEAD_NONCE_BYTES,
  assertAeadKey,
  assertAeadNonce,
  getSodium,
} from "@pluralscape/crypto";

import { env } from "../env.js";
import { fromHex } from "../lib/hex.js";

import type { AeadKey } from "@pluralscape/crypto";

/** Expected hex length for a 32-byte AEAD key. */
const ENCRYPTION_KEY_HEX_LENGTH = AEAD_KEY_BYTES * 2;

/**
 * Get the server-held webhook payload encryption key from the environment.
 * Throws if the key is not configured — webhook payloads must always be encrypted.
 */
export function getWebhookPayloadEncryptionKey(): AeadKey {
  const hex = env.WEBHOOK_PAYLOAD_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error(
      "WEBHOOK_PAYLOAD_ENCRYPTION_KEY is required. Webhook payloads must be encrypted at rest.",
    );
  }
  if (hex.length !== ENCRYPTION_KEY_HEX_LENGTH) {
    throw new Error(
      `WEBHOOK_PAYLOAD_ENCRYPTION_KEY must be a ${String(ENCRYPTION_KEY_HEX_LENGTH)}-character hex string (${String(AEAD_KEY_BYTES)} bytes).`,
    );
  }
  const key = fromHex(hex);
  assertAeadKey(key);
  return key;
}

/**
 * Encrypt a webhook payload using XChaCha20-Poly1305 with the server-held key.
 * Returns the combined nonce + ciphertext as a Uint8Array suitable for bytea storage.
 */
export function encryptWebhookPayload(plaintext: string, key: AeadKey): Uint8Array {
  assertAeadKey(key);
  const adapter = getSodium();
  const plaintextBytes = new TextEncoder().encode(plaintext);
  const result = adapter.aeadEncrypt(plaintextBytes, null, key);
  const combined = new Uint8Array(AEAD_NONCE_BYTES + result.ciphertext.length);
  combined.set(result.nonce, 0);
  combined.set(result.ciphertext, AEAD_NONCE_BYTES);
  return combined;
}

/**
 * Decrypt a webhook payload from its encrypted storage form.
 * Expects the combined nonce + ciphertext format produced by encryptWebhookPayload.
 *
 * @throws {Error} if decryption fails (wrong key, corrupted data)
 */
export function decryptWebhookPayload(encrypted: Uint8Array, key: AeadKey): string {
  assertAeadKey(key);
  if (encrypted.length <= AEAD_NONCE_BYTES) {
    throw new Error("Encrypted webhook payload too short");
  }
  const adapter = getSodium();
  const nonce = encrypted.slice(0, AEAD_NONCE_BYTES);
  const ciphertext = encrypted.slice(AEAD_NONCE_BYTES);
  assertAeadNonce(nonce);
  const plaintext = adapter.aeadDecrypt(ciphertext, nonce, null, key);
  return new TextDecoder().decode(plaintext);
}
