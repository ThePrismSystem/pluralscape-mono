import { KDF_KEY_BYTES } from "../crypto.constants.js";
import { getSodium } from "../sodium.js";
import { encrypt, encryptStream, encryptStreamAsync } from "../symmetric.js";
import { assertAeadKey } from "../validation.js";

import {
  KDF_CONTEXT_BLOB,
  STREAM_THRESHOLD,
  SUBKEY_BLOB_ENCRYPTION,
  U32_SIZE,
} from "./blob-constants.js";

import type { StreamInput } from "../symmetric.js";
import type { AeadKey, KdfMasterKey } from "../types.js";
import type { EncryptedBlobResult } from "./blob-encryption-metadata.js";
import type { BucketId } from "@pluralscape/types";

/** Parameters for encrypting an in-memory blob. */
export type EncryptBlobParams =
  | { readonly data: Uint8Array; readonly tier: 1; readonly masterKey: KdfMasterKey }
  | {
      readonly data: Uint8Array;
      readonly tier: 2;
      readonly bucketKey: AeadKey;
      readonly bucketId: BucketId;
    };

/**
 * Parameters for encrypting a streaming blob.
 *
 * Callers that produce bytes as a `ReadableStream<Uint8Array>` or an
 * `AsyncIterable<Uint8Array>` (large file uploads, camera roll pipes, decoded
 * videos, fetch bodies) should prefer {@link encryptBlobStream} over buffering
 * the full payload into a single `Uint8Array`.
 */
export type EncryptBlobStreamParams =
  | { readonly data: StreamInput; readonly tier: 1; readonly masterKey: KdfMasterKey }
  | {
      readonly data: StreamInput;
      readonly tier: 2;
      readonly bucketKey: AeadKey;
      readonly bucketId: BucketId;
    };

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
      const encryptedData = serializeStreamPayload(payload);
      return {
        encryptedData,
        metadata: {
          tier: params.tier,
          algorithm: "xchacha20-poly1305",
          bucketId: params.tier === 2 ? params.bucketId : null,
          streamed: true,
        },
        payload,
      };
    }

    const payload = encrypt(params.data, key);
    const encryptedData = new Uint8Array(payload.nonce.byteLength + payload.ciphertext.byteLength);
    encryptedData.set(payload.nonce, 0);
    encryptedData.set(payload.ciphertext, payload.nonce.byteLength);
    return {
      encryptedData,
      metadata: {
        tier: params.tier,
        algorithm: "xchacha20-poly1305",
        bucketId: params.tier === 2 ? params.bucketId : null,
        streamed: false,
      },
      payload,
    };
  } finally {
    if (params.tier === 1) {
      getSodium().memzero(key);
    }
  }
}

/**
 * Streaming-input variant of {@link encryptBlob}.
 *
 * Produces the same {@link EncryptedBlobResult} but never requires the caller
 * to materialize the full plaintext as a single `Uint8Array`. When
 * `params.data` is already a `Uint8Array`, this delegates to {@link encryptBlob}
 * to preserve the small-blob fast path.
 */
export async function encryptBlobStream(
  params: EncryptBlobStreamParams,
): Promise<EncryptedBlobResult> {
  if (params.data instanceof Uint8Array) {
    // In-memory input — delegate to the synchronous path so the sub-threshold
    // fast path (no chunking) is preserved.
    if (params.tier === 1) {
      return encryptBlob({ data: params.data, tier: 1, masterKey: params.masterKey });
    }
    return encryptBlob({
      data: params.data,
      tier: 2,
      bucketKey: params.bucketKey,
      bucketId: params.bucketId,
    });
  }

  const key = resolveBlobKey(params);
  try {
    const payload = await encryptStreamAsync(params.data, key);
    const encryptedData = serializeStreamPayload(payload);
    return {
      encryptedData,
      metadata: {
        tier: params.tier,
        algorithm: "xchacha20-poly1305",
        bucketId: params.tier === 2 ? params.bucketId : null,
        streamed: true,
      },
      payload,
    };
  } finally {
    if (params.tier === 1) {
      getSodium().memzero(key);
    }
  }
}

/** Resolve the encryption key based on tier. Shared between the sync and stream paths. */
function resolveBlobKey(params: EncryptBlobParams | EncryptBlobStreamParams): AeadKey {
  if (params.tier === 1) {
    const adapter = getSodium();
    const derivedKey = adapter.kdfDeriveFromKey(
      KDF_KEY_BYTES,
      SUBKEY_BLOB_ENCRYPTION,
      KDF_CONTEXT_BLOB,
      params.masterKey,
    );
    assertAeadKey(derivedKey);
    return derivedKey;
  }

  return params.bucketKey;
}

/** Serialize a stream encrypted payload into a single Uint8Array. */
function serializeStreamPayload(payload: ReturnType<typeof encryptStream>): Uint8Array {
  // Format: uint32le(chunkCount) || uint32le(totalLength) || for each chunk: uint32le(nonceLen) || nonce || uint32le(ctLen) || ciphertext
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
