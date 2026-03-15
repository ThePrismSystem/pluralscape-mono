import {
  AEAD_KEY_BYTES,
  AEAD_NONCE_BYTES,
  BOX_NONCE_BYTES,
  BOX_PUBLIC_KEY_BYTES,
  BOX_SECRET_KEY_BYTES,
  BOX_SEED_BYTES,
  GENERIC_HASH_BYTES_MAX,
  GENERIC_HASH_BYTES_MIN,
  KDF_BYTES_MAX,
  KDF_BYTES_MIN,
  KDF_CONTEXT_BYTES,
  KDF_KEY_BYTES,
  PWHASH_SALT_BYTES,
  SIGN_BYTES,
  SIGN_PUBLIC_KEY_BYTES,
  SIGN_SECRET_KEY_BYTES,
  SIGN_SEED_BYTES,
} from "./constants.js";
import { InvalidInputError } from "./errors.js";

import type { AeadKey, KdfMasterKey, KeyVersion, PwhashSalt } from "./types.js";

export function assertBufferLength(buffer: Uint8Array, expected: number, name: string): void {
  if (buffer.length !== expected) {
    throw new InvalidInputError(
      `${name} must be ${String(expected)} bytes, got ${String(buffer.length)}`,
    );
  }
}

export function assertAeadKey(key: Uint8Array): asserts key is AeadKey {
  assertBufferLength(key, AEAD_KEY_BYTES, "AEAD key");
}

export function assertAeadNonce(nonce: Uint8Array): void {
  assertBufferLength(nonce, AEAD_NONCE_BYTES, "AEAD nonce");
}

export function assertBoxPublicKey(key: Uint8Array): void {
  assertBufferLength(key, BOX_PUBLIC_KEY_BYTES, "Box public key");
}

export function assertBoxSecretKey(key: Uint8Array): void {
  assertBufferLength(key, BOX_SECRET_KEY_BYTES, "Box secret key");
}

export function assertBoxNonce(nonce: Uint8Array): void {
  assertBufferLength(nonce, BOX_NONCE_BYTES, "Box nonce");
}

export function assertBoxSeed(seed: Uint8Array): void {
  assertBufferLength(seed, BOX_SEED_BYTES, "Box seed");
}

export function assertSignPublicKey(key: Uint8Array): void {
  assertBufferLength(key, SIGN_PUBLIC_KEY_BYTES, "Sign public key");
}

export function assertSignSecretKey(key: Uint8Array): void {
  assertBufferLength(key, SIGN_SECRET_KEY_BYTES, "Sign secret key");
}

export function assertSignature(sig: Uint8Array): void {
  assertBufferLength(sig, SIGN_BYTES, "Signature");
}

export function assertSignSeed(seed: Uint8Array): void {
  assertBufferLength(seed, SIGN_SEED_BYTES, "Sign seed");
}

export function assertPwhashSalt(salt: Uint8Array): asserts salt is PwhashSalt {
  assertBufferLength(salt, PWHASH_SALT_BYTES, "Pwhash salt");
}

export function assertKdfMasterKey(key: Uint8Array): asserts key is KdfMasterKey {
  assertBufferLength(key, KDF_KEY_BYTES, "KDF master key");
}

export function assertKdfContext(ctx: string): void {
  if (ctx.length !== KDF_CONTEXT_BYTES) {
    throw new InvalidInputError(
      `KDF context must be exactly ${String(KDF_CONTEXT_BYTES)} bytes, got ${String(ctx.length)}`,
    );
  }
}

export function assertKdfSubkeyLength(len: number): void {
  if (len < KDF_BYTES_MIN || len > KDF_BYTES_MAX) {
    throw new InvalidInputError(
      `KDF subkey length must be between ${String(KDF_BYTES_MIN)} and ${String(KDF_BYTES_MAX)}, got ${String(len)}`,
    );
  }
}

export function assertGenericHashLength(len: number): void {
  if (len < GENERIC_HASH_BYTES_MIN || len > GENERIC_HASH_BYTES_MAX) {
    throw new InvalidInputError(
      `Generic hash length must be between ${String(GENERIC_HASH_BYTES_MIN)} and ${String(GENERIC_HASH_BYTES_MAX)}, got ${String(len)}`,
    );
  }
}

export function validateKeyVersion(keyVersion: number): KeyVersion {
  if (!Number.isSafeInteger(keyVersion) || keyVersion < 1) {
    throw new InvalidInputError(
      `keyVersion must be a positive safe integer (>= 1), got ${String(keyVersion)}`,
    );
  }
  return keyVersion as KeyVersion;
}
