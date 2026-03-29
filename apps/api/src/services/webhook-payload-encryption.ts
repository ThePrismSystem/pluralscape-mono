import { createCipheriv, randomBytes } from "node:crypto";

/** AES-256-GCM nonce size in bytes. */
const NONCE_BYTES = 12;

/** AES-256-GCM authentication tag length in bytes. */
const AUTH_TAG_BYTES = 16;

/** AES-256-GCM cipher algorithm identifier. */
const CIPHER_ALGORITHM = "aes-256-gcm";

/**
 * Encrypt a webhook payload using AES-256-GCM.
 *
 * Returns base64-encoded bytes: `nonce || ciphertext || authTag`.
 * The caller is responsible for providing the correct 256-bit key.
 */
export function encryptWebhookPayload(plaintext: string, key: Buffer): string {
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv(CIPHER_ALGORITHM, key, nonce, { authTagLength: AUTH_TAG_BYTES });

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // nonce || ciphertext || authTag
  return Buffer.concat([nonce, encrypted, authTag]).toString("base64");
}
