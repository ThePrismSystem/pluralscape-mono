import { KDF_KEY_BYTES } from "../constants.js";
import { getSodium } from "../sodium.js";
import { encrypt, encryptStream } from "../symmetric.js";

import type { AeadKey, KdfMasterKey } from "../types.js";
import type { EncryptedBlobResult } from "./blob-encryption-metadata.js";
import type { BucketId } from "@pluralscape/types";

/** Parameters for encrypting a blob. */
export interface EncryptBlobParams {
  /** Raw blob bytes to encrypt. */
  readonly data: Uint8Array;
  /** Encryption tier: 1 = master key, 2 = bucket key. */
  readonly tier: 1 | 2;
  /** Master key for T1 encryption. Required when tier=1. */
  readonly masterKey?: KdfMasterKey;
  /** Bucket key for T2 encryption. Required when tier=2. */
  readonly bucketKey?: AeadKey;
  /** Bucket ID for T2 encryption. Required when tier=2. */
  readonly bucketId?: BucketId;
}

/** KDF context for blob data keys (must be exactly 8 bytes). */
const KDF_CONTEXT_BLOB = "blobdata";

/** KDF sub-key ID for blob encryption. */
const SUBKEY_BLOB_ENCRYPTION = 2;

/** Threshold for switching to streaming encryption (64 KiB). */
const STREAM_THRESHOLD = 65_536;

/**
 * Encrypts raw blob bytes using the specified tier.
 *
 * - T1: derives a data key from the master key via KDF
 * - T2: uses the provided bucket key directly
 * - Blobs > 64 KiB use streaming (chunked) encryption
 */
export function encryptBlob(params: EncryptBlobParams): EncryptedBlobResult {
  const key = resolveBlobKey(params);
  const streamed = params.data.byteLength > STREAM_THRESHOLD;

  try {
    if (streamed) {
      const payload = encryptStream(params.data, key);
      // Serialize stream chunks into a single Uint8Array for storage
      const encryptedData = serializeStreamPayload(payload);
      return {
        encryptedData,
        metadata: {
          tier: params.tier,
          algorithm: "xchacha20-poly1305",
          bucketId: params.tier === 2 ? (params.bucketId ?? null) : null,
          streamed: true,
        },
        payload,
      };
    }

    const payload = encrypt(params.data, key);
    // For non-streamed: prepend nonce to ciphertext for self-contained storage
    const encryptedData = new Uint8Array(payload.nonce.byteLength + payload.ciphertext.byteLength);
    encryptedData.set(payload.nonce, 0);
    encryptedData.set(payload.ciphertext, payload.nonce.byteLength);
    return {
      encryptedData,
      metadata: {
        tier: params.tier,
        algorithm: "xchacha20-poly1305",
        bucketId: params.tier === 2 ? (params.bucketId ?? null) : null,
        streamed: false,
      },
      payload,
    };
  } finally {
    // Zero derived keys for T1 (T2 bucket keys are managed by the caller)
    if (params.tier === 1) {
      getSodium().memzero(key);
    }
  }
}

/** Resolve the encryption key based on tier. */
function resolveBlobKey(params: EncryptBlobParams): AeadKey {
  if (params.tier === 1) {
    if (!params.masterKey) {
      throw new Error("masterKey is required for T1 encryption.");
    }
    const adapter = getSodium();
    return adapter.kdfDeriveFromKey(
      KDF_KEY_BYTES,
      SUBKEY_BLOB_ENCRYPTION,
      KDF_CONTEXT_BLOB,
      params.masterKey,
    ) as AeadKey;
  }

  if (!params.bucketKey) {
    throw new Error("bucketKey is required for T2 encryption.");
  }
  return params.bucketKey;
}

/** Serialize a stream encrypted payload into a single Uint8Array. */
function serializeStreamPayload(payload: ReturnType<typeof encryptStream>): Uint8Array {
  // Format: uint32le(chunkCount) || uint32le(totalLength) || for each chunk: uint32le(nonceLen) || nonce || uint32le(ctLen) || ciphertext
  const U32_SIZE = 4;
  const CHUNK_OVERHEAD = 8; // 4 bytes nonce len + 4 bytes ct len
  const FILE_HEADER = 8; // chunkCount + totalLength

  let totalSize = FILE_HEADER;
  for (const chunk of payload.chunks) {
    totalSize += CHUNK_OVERHEAD + chunk.nonce.byteLength + chunk.ciphertext.byteLength;
  }

  const result = new Uint8Array(totalSize);
  const view = new DataView(result.buffer, result.byteOffset, result.byteLength);

  let offset = 0;
  view.setUint32(offset, payload.chunks.length, true);
  offset += U32_SIZE;
  view.setUint32(offset, payload.totalLength, true);
  offset += U32_SIZE;

  for (const chunk of payload.chunks) {
    view.setUint32(offset, chunk.nonce.byteLength, true);
    offset += U32_SIZE;
    result.set(chunk.nonce, offset);
    offset += chunk.nonce.byteLength;

    view.setUint32(offset, chunk.ciphertext.byteLength, true);
    offset += U32_SIZE;
    result.set(chunk.ciphertext, offset);
    offset += chunk.ciphertext.byteLength;
  }

  return result;
}
