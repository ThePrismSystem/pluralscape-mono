import { KDF_KEY_BYTES } from "../constants.js";
import { getSodium } from "../sodium.js";
import { decrypt, decryptStream } from "../symmetric.js";

import type { EncryptedPayload, StreamEncryptedPayload } from "../symmetric.js";
import type { AeadKey, AeadNonce, KdfMasterKey } from "../types.js";
import type { BlobEncryptionMetadata } from "./blob-encryption-metadata.js";

/** Parameters for decrypting a blob. */
export interface DecryptBlobParams {
  /** Encrypted blob bytes from storage. */
  readonly encryptedData: Uint8Array;
  /** Encryption metadata from the DB record. */
  readonly metadata: BlobEncryptionMetadata;
  /** Master key for T1 decryption. Required when tier=1. */
  readonly masterKey?: KdfMasterKey;
  /** Bucket key for T2 decryption. Required when tier=2. */
  readonly bucketKey?: AeadKey;
}

/** KDF context for blob data keys (must be exactly 8 bytes). */
const KDF_CONTEXT_BLOB = "blobdata";

/** KDF sub-key ID for blob encryption. */
const SUBKEY_BLOB_ENCRYPTION = 2;

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

    // Non-streamed: encryptedData is raw ciphertext, nonce is prepended
    const payload = deserializePayload(params.encryptedData);
    return decrypt(payload, key);
  } finally {
    if (params.metadata.tier === 1) {
      getSodium().memzero(key);
    }
  }
}

/** Resolve the decryption key based on tier. */
function resolveDecryptKey(params: DecryptBlobParams): AeadKey {
  if (params.metadata.tier === 1) {
    if (!params.masterKey) {
      throw new Error("masterKey is required for T1 decryption.");
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
    throw new Error("bucketKey is required for T2 decryption.");
  }
  return params.bucketKey;
}

const HEADER_SIZE = 4;

/** Deserialize a non-streamed encrypted payload. */
function deserializePayload(data: Uint8Array): EncryptedPayload {
  const adapter = getSodium();
  const nonceBytes = adapter.constants.AEAD_NONCE_BYTES;

  if (data.byteLength < nonceBytes) {
    throw new Error("Encrypted data too short to contain nonce.");
  }

  // For non-streamed, the data is just the ciphertext (nonce is in the payload)
  // But our encrypt() function returns separate ciphertext and nonce.
  // The encryptBlob non-streamed path stores only ciphertext.
  // We need to store nonce separately — which we do in the payload.
  // For storage, we prepend the nonce to the ciphertext.
  const nonce = data.subarray(0, nonceBytes) as AeadNonce;
  const ciphertext = data.subarray(nonceBytes);
  return { ciphertext, nonce };
}

/** Deserialize a stream-encrypted payload from a single Uint8Array. */
function deserializeStreamPayload(data: Uint8Array): StreamEncryptedPayload {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  let offset = 0;
  const chunkCount = view.getUint32(offset, true);
  offset += HEADER_SIZE;
  const totalLength = view.getUint32(offset, true);
  offset += HEADER_SIZE;

  const chunks: EncryptedPayload[] = [];

  for (let i = 0; i < chunkCount; i++) {
    const nonceLen = view.getUint32(offset, true);
    offset += HEADER_SIZE;
    const nonce = data.subarray(offset, offset + nonceLen) as AeadNonce;
    offset += nonceLen;

    const ctLen = view.getUint32(offset, true);
    offset += HEADER_SIZE;
    const ciphertext = data.subarray(offset, offset + ctLen);
    offset += ctLen;

    chunks.push({ ciphertext, nonce });
  }

  return { chunks, totalLength };
}
