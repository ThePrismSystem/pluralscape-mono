import { SIGN_BYTES } from "./crypto.constants.js";
import { InvalidInputError, SignatureVerificationError } from "./errors.js";
import { getSodium } from "./sodium.js";
import { decrypt, encrypt } from "./symmetric.js";
import { assertSignature } from "./validation.js";

import type { EncryptedPayload } from "./symmetric.js";
import type { AeadKey, Signature, SignPublicKey, SignSecretKey } from "./types.js";

/** Create a detached Ed25519 signature over data. */
export function sign(data: Uint8Array, signingKey: SignSecretKey): Signature {
  return getSodium().signDetached(data, signingKey);
}

/** Verify a detached Ed25519 signature. Returns true if valid. */
export function verify(data: Uint8Array, signature: Signature, publicKey: SignPublicKey): boolean {
  return getSodium().signVerifyDetached(signature, data, publicKey);
}

/**
 * Sign data then encrypt the combined payload.
 * Wire format: signature (64B) || plaintext
 */
export function signThenEncrypt(
  data: Uint8Array,
  signingKey: SignSecretKey,
  encryptionKey: AeadKey,
): EncryptedPayload {
  const sig = sign(data, signingKey);
  const combined = new Uint8Array(SIGN_BYTES + data.length);
  combined.set(sig, 0);
  combined.set(data, SIGN_BYTES);
  try {
    return encrypt(combined, encryptionKey);
  } finally {
    getSodium().memzero(combined);
  }
}

/**
 * Decrypt payload then verify the embedded Ed25519 signature.
 * Throws DecryptionFailedError if decryption fails.
 * Throws InvalidInputError if the inner payload is shorter than the signature.
 * Throws SignatureVerificationError if the signature does not match.
 */
export function decryptThenVerify(
  payload: EncryptedPayload,
  decryptionKey: AeadKey,
  signingPublicKey: SignPublicKey,
): Uint8Array {
  const combined = decrypt(payload, decryptionKey);
  if (combined.length < SIGN_BYTES) {
    throw new InvalidInputError(
      `Decrypted payload too short: expected at least ${String(SIGN_BYTES)} bytes for signature, got ${String(combined.length)}.`,
    );
  }
  const sigBytes = combined.subarray(0, SIGN_BYTES);
  assertSignature(sigBytes);
  const sig = sigBytes;
  const data = combined.subarray(SIGN_BYTES);
  if (!verify(data, sig, signingPublicKey)) {
    throw new SignatureVerificationError();
  }
  return data;
}
