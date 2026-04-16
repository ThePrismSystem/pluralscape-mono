import { AEAD_KEY_BYTES, BOX_MAC_BYTES, BOX_NONCE_BYTES } from "./crypto.constants.js";
import { InvalidInputError } from "./errors.js";
import { getSodium } from "./sodium.js";
import {
  assertAeadKey,
  assertBoxPublicKey,
  assertBoxSecretKey,
  validateKeyVersion,
} from "./validation.js";

import type { AeadKey, BoxNonce, BoxPublicKey, BoxSecretKey, EncryptedKeyGrant } from "./types.js";
import type { BucketId } from "@pluralscape/types";

/**
 * Key grant wire format:
 *
 * Outer blob: [24B nonce] [16B MAC + encrypted envelope]
 *
 * Envelope plaintext: [uint16le id-length] [id UTF-8 bytes] [uint32le keyVersion] [32B bucket key]
 *
 * The envelope is encrypted with crypto_box (XSalsa20-Poly1305) so that
 * tampering with the binding metadata (bucket ID, key version) causes
 * authenticated decryption to fail.
 */

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
  readonly encryptedBucketKey: EncryptedKeyGrant;
}

/** Fields shared by single and batch key grant creation. */
interface KeyGrantBaseParams {
  readonly bucketKey: AeadKey;
  readonly bucketId: BucketId;
  readonly keyVersion: number;
  readonly senderSecretKey: BoxSecretKey;
}

export interface CreateKeyGrantParams extends KeyGrantBaseParams {
  readonly recipientPublicKey: BoxPublicKey;
}

export interface CreateKeyGrantsBatchParams extends KeyGrantBaseParams {
  readonly recipientPublicKeys: readonly BoxPublicKey[];
}

export interface DecryptKeyGrantParams {
  readonly encryptedBucketKey: EncryptedKeyGrant;
  readonly bucketId: BucketId;
  readonly keyVersion: number;
  readonly senderPublicKey: BoxPublicKey;
  readonly recipientSecretKey: BoxSecretKey;
}

/**
 * Build the plaintext envelope that binds the bucket key to its bucket ID and version.
 * See wire format documentation above for envelope layout.
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
  let offset = 0;
  view.setUint16(offset, idBytes.length, true /* little-endian */);
  offset += UINT16_BYTES;
  envelope.set(idBytes, offset);
  offset += idBytes.length;
  view.setUint32(offset, keyVersion, true /* little-endian */);
  offset += UINT32_BYTES;
  envelope.set(bucketKey, offset);
  return envelope;
}

/**
 * Parse and validate the decrypted envelope.
 * See wire format documentation above for envelope layout.
 *
 * @throws InvalidInputError if the extracted bucket ID or key version does not match expected values.
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

  let offset = UINT16_BYTES;
  const idBytes = plaintext.subarray(offset, offset + idLen);
  offset += idLen;
  const expectedIdBytes = new TextEncoder().encode(expectedBucketId);
  if (idBytes.length !== expectedIdBytes.length || !getSodium().memcmp(idBytes, expectedIdBytes)) {
    const extractedId = new TextDecoder().decode(idBytes);
    throw new InvalidInputError(
      `Key grant bucket ID mismatch: expected "${expectedBucketId}", got "${extractedId}".`,
    );
  }

  const extractedVersion = view.getUint32(offset, true);
  offset += UINT32_BYTES;
  // Integer comparison of fixed-width uint32 values is already constant-time.
  if (extractedVersion !== expectedKeyVersion) {
    throw new InvalidInputError(
      `Key grant key version mismatch: expected ${String(expectedKeyVersion)}, got ${String(extractedVersion)}.`,
    );
  }

  const keyBytes = plaintext.slice(offset);
  assertAeadKey(keyBytes);
  return keyBytes;
}

/**
 * Seal an envelope for a single recipient using crypto_box.
 * Returns the concatenated [nonce || ciphertext] blob.
 */
function sealEnvelope(
  envelope: Uint8Array,
  recipientPublicKey: BoxPublicKey,
  senderSecretKey: BoxSecretKey,
): EncryptedKeyGrant {
  const adapter = getSodium();
  const nonce = adapter.randomBytes(BOX_NONCE_BYTES) as BoxNonce;
  const ciphertext = adapter.boxEasy(envelope, nonce, recipientPublicKey, senderSecretKey);
  const result = new Uint8Array(BOX_NONCE_BYTES + ciphertext.length);
  result.set(nonce, 0);
  result.set(ciphertext, BOX_NONCE_BYTES);
  return result as EncryptedKeyGrant;
}

/**
 * Encrypt a bucket key for a single recipient using crypto_box (XSalsa20-Poly1305).
 * See wire format documentation above for blob layout.
 *
 * @throws InvalidInputError on invalid inputs (bad key sizes, invalid keyVersion, oversized bucketId).
 */
export function createKeyGrant(params: CreateKeyGrantParams): KeyGrantBlob {
  const { bucketKey, bucketId, keyVersion, recipientPublicKey, senderSecretKey } = params;
  validateKeyVersion(keyVersion);
  assertAeadKey(bucketKey);
  assertBoxPublicKey(recipientPublicKey);
  assertBoxSecretKey(senderSecretKey);

  const envelope = buildEnvelope(bucketId, keyVersion, bucketKey);
  try {
    const encryptedBucketKey = sealEnvelope(envelope, recipientPublicKey, senderSecretKey);
    return { encryptedBucketKey };
  } finally {
    getSodium().memzero(envelope);
  }
}

/**
 * Decrypt a key grant to recover the bucket key.
 * See wire format documentation above for blob layout.
 *
 * @throws DecryptionFailedError on wrong keys or tampered ciphertext.
 * @throws InvalidInputError on binding mismatches or malformed input.
 */
export function decryptKeyGrant(params: DecryptKeyGrantParams): AeadKey {
  const { encryptedBucketKey, bucketId, keyVersion, senderPublicKey, recipientSecretKey } = params;
  validateKeyVersion(keyVersion);
  assertBoxPublicKey(senderPublicKey);
  assertBoxSecretKey(recipientSecretKey);

  if (encryptedBucketKey.length < MIN_BLOB_BYTES) {
    throw new InvalidInputError(
      `Encrypted bucket key blob too short: minimum ${String(MIN_BLOB_BYTES)} bytes, got ${String(encryptedBucketKey.length)}.`,
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
 * See wire format documentation above for blob layout.
 *
 * The envelope is built once and reused for all grants. Each grant gets a fresh
 * random nonce. The envelope is memzeroed in a finally block after all grants are created.
 *
 * @throws InvalidInputError on invalid inputs (bad key sizes, invalid keyVersion, oversized bucketId,
 *   empty recipients, or invalid recipient public key).
 */
export function createKeyGrants(params: CreateKeyGrantsBatchParams): readonly KeyGrantBlob[] {
  const { bucketKey, bucketId, keyVersion, recipientPublicKeys, senderSecretKey } = params;
  validateKeyVersion(keyVersion);
  assertAeadKey(bucketKey);
  assertBoxSecretKey(senderSecretKey);

  if (recipientPublicKeys.length === 0) {
    throw new InvalidInputError("recipientPublicKeys must not be empty.");
  }

  // Validate all recipient keys eagerly before building the envelope
  for (const pk of recipientPublicKeys) {
    assertBoxPublicKey(pk);
  }

  const envelope = buildEnvelope(bucketId, keyVersion, bucketKey);
  try {
    return recipientPublicKeys.map((recipientPublicKey) => {
      const encryptedBucketKey = sealEnvelope(envelope, recipientPublicKey, senderSecretKey);
      return { encryptedBucketKey };
    });
  } finally {
    getSodium().memzero(envelope);
  }
}
