import { AEAD_NONCE_BYTES } from "./constants.js";
import { InvalidInputError } from "./errors.js";

import type {
  BucketId,
  EncryptedBlob,
  EncryptionAlgorithm,
  T1EncryptedBlob,
  T2EncryptedBlob,
} from "@pluralscape/types";

/**
 * Binary wire format for EncryptedBlob ↔ Uint8Array.
 *
 * Every `pgEncryptedBlob` / `sqliteEncryptedBlob` column stores a single blob
 * encoded with this codec. The format is self-describing — **nonces and
 * keyVersions are embedded per-blob**, so no separate DB columns are needed
 * for either field. This resolves db-kveq (nonce storage) and db-0d2a
 * (keyVersion on content tables).
 *
 * Layout:
 *   [1B version=0x01]
 *   [1B tier]
 *   [1B algorithm]
 *   [4B keyVersion uint32le, 0xFFFFFFFF = null (reserved sentinel)]
 *   [1B hasBucketId]
 *   [if hasBucketId=1: 2B UTF-8 length uint16le + N bytes UTF-8 bucketId]
 *   [24B nonce]
 *   [rest: ciphertext]
 */

const FORMAT_VERSION = 0x01;
const NULL_KEY_VERSION = 0xffffffff;
/** version(1) + tier(1) + algorithm(1) + keyVersion(4) + hasBucketId(1) */
const HEADER_BYTES = 8;
const KEY_VERSION_BYTES = 4;
const BUCKET_ID_LENGTH_BYTES = 2;
const MAX_BUCKET_ID_BYTES = 0xffff;
const HEX_RADIX = 16;

const ALGORITHM_TO_BYTE = new Map<EncryptionAlgorithm, number>([["xchacha20-poly1305", 0]]);

const BYTE_TO_ALGORITHM = new Map<number, EncryptionAlgorithm>([[0, "xchacha20-poly1305"]]);

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/** Serialize an EncryptedBlob into a binary Uint8Array for DB storage. */
export function serializeEncryptedBlob(blob: EncryptedBlob): Uint8Array {
  const algorithmByte = ALGORITHM_TO_BYTE.get(blob.algorithm);
  if (algorithmByte === undefined) {
    throw new InvalidInputError(`Unknown encryption algorithm: ${blob.algorithm}`);
  }

  const tierNum: number = blob.tier;
  if (tierNum !== 1 && tierNum !== 2) {
    throw new InvalidInputError(`Invalid EncryptedBlob tier: ${String(tierNum)}`);
  }

  const hasBucketId = blob.bucketId !== null;
  if (tierNum === 2 && !hasBucketId) {
    throw new InvalidInputError("T2 EncryptedBlob requires a bucketId");
  }

  if (blob.nonce.length !== AEAD_NONCE_BYTES) {
    throw new InvalidInputError(
      `Invalid nonce length: expected ${String(AEAD_NONCE_BYTES)}, got ${String(blob.nonce.length)}`,
    );
  }

  if (blob.keyVersion === NULL_KEY_VERSION) {
    throw new InvalidInputError(
      `keyVersion ${String(NULL_KEY_VERSION)} (0xFFFFFFFF) is reserved as the null sentinel`,
    );
  }

  const bucketIdBytes = hasBucketId ? textEncoder.encode(blob.bucketId) : null;

  if (bucketIdBytes !== null && bucketIdBytes.length > MAX_BUCKET_ID_BYTES) {
    throw new InvalidInputError(
      `bucketId exceeds maximum length: ${String(bucketIdBytes.length)} bytes (max ${String(MAX_BUCKET_ID_BYTES)})`,
    );
  }

  const bucketIdSection =
    bucketIdBytes !== null ? BUCKET_ID_LENGTH_BYTES + bucketIdBytes.length : 0;

  const totalLength = HEADER_BYTES + bucketIdSection + AEAD_NONCE_BYTES + blob.ciphertext.length;
  const out = new Uint8Array(totalLength);
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);

  let offset = 0;

  // Header
  out[offset++] = FORMAT_VERSION;
  out[offset++] = blob.tier;
  out[offset++] = algorithmByte;
  view.setUint32(offset, blob.keyVersion ?? NULL_KEY_VERSION, true);
  offset += KEY_VERSION_BYTES;
  out[offset++] = bucketIdBytes !== null ? 1 : 0;

  // BucketId section
  if (bucketIdBytes !== null) {
    view.setUint16(offset, bucketIdBytes.length, true);
    offset += BUCKET_ID_LENGTH_BYTES;
    out.set(bucketIdBytes, offset);
    offset += bucketIdBytes.length;
  }

  // Nonce
  out.set(blob.nonce, offset);
  offset += AEAD_NONCE_BYTES;

  // Ciphertext
  out.set(blob.ciphertext, offset);

  return out;
}

function readByte(data: Uint8Array, pos: number): number {
  if (pos >= data.length) {
    throw new InvalidInputError(
      `EncryptedBlob buffer too short at offset ${String(pos)} (length ${String(data.length)})`,
    );
  }
  return data[pos] as number;
}

/** Deserialize a binary Uint8Array from DB storage back to an EncryptedBlob. */
export function deserializeEncryptedBlob(data: Uint8Array): EncryptedBlob {
  if (data.length < HEADER_BYTES) {
    throw new InvalidInputError(
      `EncryptedBlob buffer too short: expected at least ${String(HEADER_BYTES)} bytes, got ${String(data.length)}`,
    );
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 0;

  // Version
  const version = readByte(data, offset++);
  if (version !== FORMAT_VERSION) {
    throw new InvalidInputError(
      `Unknown EncryptedBlob version: 0x${version.toString(HEX_RADIX).padStart(2, "0")}`,
    );
  }

  // Tier
  const tier = readByte(data, offset++);
  if (tier !== 1 && tier !== 2) {
    throw new InvalidInputError(`Invalid EncryptedBlob tier: ${String(tier)}`);
  }

  // Algorithm
  const algorithmByte = readByte(data, offset++);
  const algorithm = BYTE_TO_ALGORITHM.get(algorithmByte);
  if (algorithm === undefined) {
    throw new InvalidInputError(`Unknown EncryptedBlob algorithm byte: ${String(algorithmByte)}`);
  }

  // Key version
  const rawKeyVersion = view.getUint32(offset, true);
  offset += KEY_VERSION_BYTES;
  const keyVersion = rawKeyVersion === NULL_KEY_VERSION ? null : rawKeyVersion;

  // BucketId
  const hasBucketId = readByte(data, offset++);
  if (hasBucketId !== 0 && hasBucketId !== 1) {
    throw new InvalidInputError(`Invalid hasBucketId flag: ${String(hasBucketId)}`);
  }
  let bucketId: BucketId | null = null;
  if (hasBucketId === 1) {
    if (offset + BUCKET_ID_LENGTH_BYTES > data.length) {
      throw new InvalidInputError("EncryptedBlob buffer truncated: missing bucketId length");
    }
    const bucketIdLength = view.getUint16(offset, true);
    offset += BUCKET_ID_LENGTH_BYTES;
    if (offset + bucketIdLength > data.length) {
      throw new InvalidInputError("EncryptedBlob buffer truncated: missing bucketId data");
    }
    bucketId = textDecoder.decode(data.subarray(offset, offset + bucketIdLength)) as BucketId;
    offset += bucketIdLength;
  }

  // Nonce
  if (offset + AEAD_NONCE_BYTES > data.length) {
    throw new InvalidInputError(
      `EncryptedBlob buffer truncated: missing nonce (need ${String(AEAD_NONCE_BYTES)} bytes at offset ${String(offset)}, have ${String(data.length - offset)})`,
    );
  }
  const nonce = new Uint8Array(data.subarray(offset, offset + AEAD_NONCE_BYTES));
  offset += AEAD_NONCE_BYTES;

  // Ciphertext (rest of buffer)
  const ciphertext = new Uint8Array(data.subarray(offset));

  if (tier === 1) {
    if (keyVersion !== null) {
      throw new InvalidInputError("T1 EncryptedBlob must not contain a keyVersion");
    }
    if (bucketId !== null) {
      throw new InvalidInputError("T1 EncryptedBlob must not contain a bucketId");
    }
    return {
      ciphertext,
      nonce,
      tier,
      algorithm,
      keyVersion: null,
      bucketId: null,
    } satisfies T1EncryptedBlob;
  }
  if (bucketId === null) {
    throw new InvalidInputError("T2 EncryptedBlob missing bucketId");
  }
  return { ciphertext, nonce, tier, algorithm, keyVersion, bucketId } satisfies T2EncryptedBlob;
}
