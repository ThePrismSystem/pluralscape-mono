import { AEAD_KEY_BYTES, BOX_MAC_BYTES, BOX_NONCE_BYTES } from "./constants.js";
import { InvalidInputError } from "./errors.js";
import { getSodium } from "./sodium.js";
import {
  assertAeadKey,
  assertBoxPublicKey,
  assertBoxSecretKey,
  validateKeyVersion,
} from "./validation.js";

import type { AeadKey, BoxNonce, BoxPublicKey, BoxSecretKey } from "./types.js";
import type { BucketId } from "@pluralscape/types";

/** Size of a uint16 field in the envelope, in bytes. */
const UINT16_BYTES = 2;

/** Size of a uint32 field in the envelope, in bytes. */
const UINT32_BYTES = 4;

/** Maximum allowed bucket ID UTF-8 byte length (fits in a uint16). */
const MAX_BUCKET_ID_UTF8_BYTES = 65535;

/**
 * Minimum encrypted blob size: nonce + MAC + uint16 id-len + 0-length id + uint32 version + key.
 * Assumes the shortest possible bucket ID (zero bytes).
 */
const MIN_BLOB_BYTES =
  BOX_NONCE_BYTES + BOX_MAC_BYTES + UINT16_BYTES + UINT32_BYTES + AEAD_KEY_BYTES;

/** An encrypted bucket key grant, suitable for storage on the server. */
export interface KeyGrantBlob {
  readonly encryptedBucketKey: Uint8Array;
}

export interface CreateKeyGrantParams {
  readonly bucketKey: AeadKey;
  readonly bucketId: BucketId;
  readonly keyVersion: number;
  readonly recipientPublicKey: BoxPublicKey;
  readonly senderSecretKey: BoxSecretKey;
}

export interface DecryptKeyGrantParams {
  readonly encryptedBucketKey: Uint8Array;
  readonly bucketId: BucketId;
  readonly keyVersion: number;
  readonly senderPublicKey: BoxPublicKey;
  readonly recipientSecretKey: BoxSecretKey;
}

export interface CreateKeyGrantsBatchParams {
  readonly bucketKey: AeadKey;
  readonly bucketId: BucketId;
  readonly keyVersion: number;
  readonly recipientPublicKeys: readonly BoxPublicKey[];
  readonly senderSecretKey: BoxSecretKey;
}

/**
 * Build the plaintext envelope that binds the bucket key to its bucket ID and version.
 *
 * Format: [uint16le id-length] [id UTF-8 bytes] [uint32le keyVersion] [32B bucket key]
 *
 * The envelope is used as plaintext for crypto_box so that tampering with the
 * binding metadata causes decryption (MAC) failure.
 */
function buildEnvelope(bucketId: BucketId, keyVersion: number, bucketKey: AeadKey): Uint8Array {
  const idBytes = new TextEncoder().encode(bucketId);
  if (idBytes.length > MAX_BUCKET_ID_UTF8_BYTES) {
    throw new InvalidInputError(
      `bucketId UTF-8 encoding exceeds maximum length of ${String(MAX_BUCKET_ID_UTF8_BYTES)} bytes, got ${String(idBytes.length)}`,
    );
  }
  const envelope = new Uint8Array(UINT16_BYTES + idBytes.length + UINT32_BYTES + AEAD_KEY_BYTES);
  const view = new DataView(envelope.buffer, envelope.byteOffset, envelope.byteLength);
  view.setUint16(0, idBytes.length, true /* little-endian */);
  envelope.set(idBytes, UINT16_BYTES);
  view.setUint32(UINT16_BYTES + idBytes.length, keyVersion, true /* little-endian */);
  envelope.set(bucketKey, UINT16_BYTES + idBytes.length + UINT32_BYTES);
  return envelope;
}

/**
 * Parse and validate the decrypted envelope. Throws InvalidInputError if
 * the extracted bucket ID or key version does not match the expected values.
 */
function parseEnvelope(
  plaintext: Uint8Array,
  expectedBucketId: BucketId,
  expectedKeyVersion: number,
): AeadKey {
  if (plaintext.length < UINT16_BYTES) {
    throw new InvalidInputError("Decrypted envelope too short to contain id length.");
  }
  const view = new DataView(plaintext.buffer, plaintext.byteOffset, plaintext.byteLength);
  const idLen = view.getUint16(0, true);

  const minLength = UINT16_BYTES + idLen + UINT32_BYTES + AEAD_KEY_BYTES;
  if (plaintext.length < minLength) {
    throw new InvalidInputError(
      `Decrypted envelope too short: expected at least ${String(minLength)} bytes, got ${String(plaintext.length)}.`,
    );
  }

  const idBytes = plaintext.subarray(UINT16_BYTES, UINT16_BYTES + idLen);
  const extractedId = new TextDecoder().decode(idBytes);
  if (extractedId !== expectedBucketId) {
    throw new InvalidInputError(
      `Key grant bucket ID mismatch: expected "${expectedBucketId}", got "${extractedId}".`,
    );
  }

  const extractedVersion = view.getUint32(UINT16_BYTES + idLen, true);
  if (extractedVersion !== expectedKeyVersion) {
    throw new InvalidInputError(
      `Key grant key version mismatch: expected ${String(expectedKeyVersion)}, got ${String(extractedVersion)}.`,
    );
  }

  const keyBytes = plaintext.subarray(UINT16_BYTES + idLen + UINT32_BYTES);
  assertAeadKey(keyBytes);
  return keyBytes as AeadKey;
}

/**
 * Encrypt a bucket key for a single recipient using crypto_box (XSalsa20-Poly1305).
 *
 * The plaintext envelope binds the bucket ID and key version so that any tampering
 * with these fields causes authenticated decryption to fail.
 *
 * Wire format: [24B nonce] [16B MAC + encrypted envelope]
 */
export function createKeyGrant(params: CreateKeyGrantParams): KeyGrantBlob {
  const { bucketKey, bucketId, keyVersion, recipientPublicKey, senderSecretKey } = params;
  validateKeyVersion(keyVersion);
  assertAeadKey(bucketKey);
  assertBoxPublicKey(recipientPublicKey);
  assertBoxSecretKey(senderSecretKey);

  const adapter = getSodium();
  const nonce = adapter.randomBytes(BOX_NONCE_BYTES) as BoxNonce;
  const envelope = buildEnvelope(bucketId, keyVersion, bucketKey);
  try {
    const ciphertext = adapter.boxEasy(envelope, nonce, recipientPublicKey, senderSecretKey);
    const encryptedBucketKey = new Uint8Array(BOX_NONCE_BYTES + ciphertext.length);
    encryptedBucketKey.set(nonce, 0);
    encryptedBucketKey.set(ciphertext, BOX_NONCE_BYTES);
    return { encryptedBucketKey };
  } finally {
    adapter.memzero(envelope);
  }
}

/**
 * Decrypt a key grant to recover the bucket key.
 *
 * Verifies the AAD binding (bucket ID and key version) after decryption.
 * Throws DecryptionFailedError on wrong keys or tampered ciphertext.
 * Throws InvalidInputError on binding mismatches or malformed input.
 */
export function decryptKeyGrant(params: DecryptKeyGrantParams): AeadKey {
  const { encryptedBucketKey, bucketId, keyVersion, senderPublicKey, recipientSecretKey } = params;
  validateKeyVersion(keyVersion);
  assertBoxPublicKey(senderPublicKey);
  assertBoxSecretKey(recipientSecretKey);

  const MIN_BLOB_LENGTH = MIN_BLOB_BYTES;
  if (encryptedBucketKey.length < MIN_BLOB_LENGTH) {
    throw new InvalidInputError(
      `Encrypted bucket key blob too short: minimum ${String(MIN_BLOB_LENGTH)} bytes, got ${String(encryptedBucketKey.length)}.`,
    );
  }

  const adapter = getSodium();
  const nonce = encryptedBucketKey.subarray(0, BOX_NONCE_BYTES) as BoxNonce;
  const ciphertext = encryptedBucketKey.subarray(BOX_NONCE_BYTES);

  // boxOpenEasy throws DecryptionFailedError on wrong keys or tampered data
  const plaintext = adapter.boxOpenEasy(ciphertext, nonce, senderPublicKey, recipientSecretKey);

  return parseEnvelope(plaintext, bucketId, keyVersion);
}

/**
 * Encrypt a bucket key for multiple recipients in a single call.
 *
 * The envelope is built once and reused for all grants. Each grant gets a fresh
 * random nonce. The envelope is memzeroed in a finally block after all grants are created.
 */
export function createKeyGrants(params: CreateKeyGrantsBatchParams): readonly KeyGrantBlob[] {
  const { bucketKey, bucketId, keyVersion, recipientPublicKeys, senderSecretKey } = params;
  validateKeyVersion(keyVersion);
  assertAeadKey(bucketKey);
  assertBoxSecretKey(senderSecretKey);

  if (recipientPublicKeys.length === 0) {
    throw new InvalidInputError("recipientPublicKeys must not be empty.");
  }

  const adapter = getSodium();
  const envelope = buildEnvelope(bucketId, keyVersion, bucketKey);
  try {
    return recipientPublicKeys.map((recipientPublicKey) => {
      assertBoxPublicKey(recipientPublicKey);
      const nonce = adapter.randomBytes(BOX_NONCE_BYTES) as BoxNonce;
      const ciphertext = adapter.boxEasy(envelope, nonce, recipientPublicKey, senderSecretKey);
      const encryptedBucketKey = new Uint8Array(BOX_NONCE_BYTES + ciphertext.length);
      encryptedBucketKey.set(nonce, 0);
      encryptedBucketKey.set(ciphertext, BOX_NONCE_BYTES);
      return { encryptedBucketKey };
    });
  } finally {
    adapter.memzero(envelope);
  }
}
