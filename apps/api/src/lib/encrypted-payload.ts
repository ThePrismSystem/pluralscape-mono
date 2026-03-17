import { AEAD_NONCE_BYTES } from "@pluralscape/crypto";

import type { EncryptedPayload } from "@pluralscape/crypto";
import type { AeadNonce } from "@pluralscape/crypto";

/** Concatenate nonce + ciphertext for DB storage. */
export function serializeEncryptedPayload(payload: {
  ciphertext: Uint8Array;
  nonce: Uint8Array;
}): Uint8Array {
  const result = new Uint8Array(payload.nonce.length + payload.ciphertext.length);
  result.set(payload.nonce, 0);
  result.set(payload.ciphertext, payload.nonce.length);
  return result;
}

/**
 * Split stored bytes back into nonce + ciphertext.
 * Returns a branded EncryptedPayload compatible with crypto functions.
 */
export function deserializeEncryptedPayload(bytes: Uint8Array): EncryptedPayload {
  const nonce = bytes.slice(0, AEAD_NONCE_BYTES) as AeadNonce;
  const ciphertext = bytes.slice(AEAD_NONCE_BYTES);
  return { ciphertext, nonce };
}
