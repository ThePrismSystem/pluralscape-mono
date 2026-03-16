import { AEAD_NONCE_BYTES, AEAD_TAG_BYTES } from "./crypto.constants.js";
import { InvalidInputError } from "./errors.js";

import type { EncryptedPayload } from "./symmetric.js";
import type { AeadNonce } from "./types.js";

/**
 * Serialize an EncryptedPayload to a flat binary blob for database storage.
 *
 * Layout: [24-byte nonce][ciphertext]
 * The nonce is always exactly AEAD_NONCE_BYTES (24) bytes for XChaCha20.
 */
export function serializeRecoveryBackup(payload: EncryptedPayload): Uint8Array {
  const out = new Uint8Array(AEAD_NONCE_BYTES + payload.ciphertext.length);
  out.set(payload.nonce, 0);
  out.set(payload.ciphertext, AEAD_NONCE_BYTES);
  return out;
}

/** Minimum valid blob size: nonce (24) + AEAD authentication tag (16). */
const MIN_BACKUP_BYTES = AEAD_NONCE_BYTES + AEAD_TAG_BYTES;

/**
 * Deserialize a flat binary blob back into an EncryptedPayload.
 *
 * Throws InvalidInputError if the blob is shorter than a nonce + authentication tag.
 */
export function deserializeRecoveryBackup(blob: Uint8Array): EncryptedPayload {
  if (blob.length < MIN_BACKUP_BYTES) {
    throw new InvalidInputError(
      `Recovery backup blob must be at least ${String(MIN_BACKUP_BYTES)} bytes, got ${String(blob.length)}`,
    );
  }
  const nonce = blob.slice(0, AEAD_NONCE_BYTES) as AeadNonce;
  const ciphertext = blob.slice(AEAD_NONCE_BYTES);
  return { nonce, ciphertext };
}
