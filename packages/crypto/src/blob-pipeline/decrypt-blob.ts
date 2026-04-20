import { AEAD_TAG_BYTES, KDF_KEY_BYTES } from "../crypto.constants.js";
import { InvalidInputError } from "../errors.js";
import { getSodium } from "../sodium.js";
import {
  MAX_DECRYPT_STREAM_BYTES,
  MAX_STREAM_CHUNKS,
  decrypt,
  decryptStream,
} from "../symmetric.js";
import { assertAeadKey, assertAeadNonce } from "../validation.js";

import { KDF_CONTEXT_BLOB, SUBKEY_BLOB_ENCRYPTION, U32_SIZE } from "./blob-constants.js";

import type { EncryptedPayload, StreamEncryptedPayload } from "../symmetric.js";
import type { AeadKey, KdfMasterKey } from "../types.js";
import type { BlobEncryptionMetadata } from "./blob-encryption-metadata.js";

/** Parameters for decrypting a blob. */
export type DecryptBlobParams =
  | {
      readonly encryptedData: Uint8Array;
      readonly metadata: BlobEncryptionMetadata;
      readonly tier: 1;
      readonly masterKey: KdfMasterKey;
    }
  | {
      readonly encryptedData: Uint8Array;
      readonly metadata: BlobEncryptionMetadata;
      readonly tier: 2;
      readonly bucketKey: AeadKey;
    };

/**
 * Decrypts encrypted blob bytes using the specified tier.
 * Inverse of encryptBlob().
 */
export function decryptBlob(params: DecryptBlobParams): Uint8Array {
  const key = resolveDecryptKey(params);

  try {
    if (params.metadata.streamed) {
      const payload = deserializeStreamPayload(params.encryptedData);
      return decryptStream(payload, key);
    }

    const payload = deserializePayload(params.encryptedData);
    return decrypt(payload, key);
  } finally {
    if (params.tier === 1) {
      getSodium().memzero(key);
    }
  }
}

/** Resolve the decryption key based on tier. */
function resolveDecryptKey(params: DecryptBlobParams): AeadKey {
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

/** Deserialize a non-streamed encrypted payload. */
function deserializePayload(data: Uint8Array): EncryptedPayload {
  const adapter = getSodium();
  const nonceBytes = adapter.constants.AEAD_NONCE_BYTES;

  if (data.byteLength < nonceBytes + AEAD_TAG_BYTES) {
    throw new InvalidInputError("Encrypted data too short to contain nonce and tag.");
  }

  const nonce = data.subarray(0, nonceBytes);
  assertAeadNonce(nonce);
  const ciphertext = data.subarray(nonceBytes);
  return { ciphertext, nonce };
}

/** Deserialize a stream-encrypted payload from a single Uint8Array. */
function deserializeStreamPayload(data: Uint8Array): StreamEncryptedPayload {
  const HEADER_BYTES = 2 * U32_SIZE;

  if (data.byteLength < HEADER_BYTES) {
    throw new InvalidInputError("Stream payload too short to contain header.");
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  let offset = 0;
  const chunkCount = view.getUint32(offset, true);
  offset += U32_SIZE;
  const totalLength = view.getUint32(offset, true);
  offset += U32_SIZE;

  if (chunkCount > MAX_STREAM_CHUNKS) {
    throw new InvalidInputError(
      `Stream chunk count ${String(chunkCount)} exceeds maximum ${String(MAX_STREAM_CHUNKS)}.`,
    );
  }
  if (totalLength > MAX_DECRYPT_STREAM_BYTES) {
    throw new InvalidInputError(
      `Stream totalLength ${String(totalLength)} exceeds maximum ${String(MAX_DECRYPT_STREAM_BYTES)}.`,
    );
  }

  const chunks: EncryptedPayload[] = [];

  for (let i = 0; i < chunkCount; i++) {
    if (offset + U32_SIZE > data.byteLength) {
      throw new InvalidInputError(`Truncated stream payload at chunk ${String(i)} nonce length.`);
    }
    const nonceLen = view.getUint32(offset, true);
    offset += U32_SIZE;

    if (offset + nonceLen > data.byteLength) {
      throw new InvalidInputError(`Truncated stream payload at chunk ${String(i)} nonce data.`);
    }
    const nonce = data.subarray(offset, offset + nonceLen);
    assertAeadNonce(nonce);
    offset += nonceLen;

    if (offset + U32_SIZE > data.byteLength) {
      throw new InvalidInputError(
        `Truncated stream payload at chunk ${String(i)} ciphertext length.`,
      );
    }
    const ctLen = view.getUint32(offset, true);
    offset += U32_SIZE;

    if (offset + ctLen > data.byteLength) {
      throw new InvalidInputError(
        `Truncated stream payload at chunk ${String(i)} ciphertext data.`,
      );
    }
    const ciphertext = data.subarray(offset, offset + ctLen);
    offset += ctLen;

    chunks.push({ ciphertext, nonce });
  }

  return { chunks, totalLength };
}
