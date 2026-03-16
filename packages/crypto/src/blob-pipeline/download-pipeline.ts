import { decryptBlob } from "./decrypt-blob.js";

import type { AeadKey, KdfMasterKey } from "../types.js";
import type { BlobEncryptionMetadata } from "./blob-encryption-metadata.js";

/** Parameters for processing a downloaded blob. */
export interface ProcessDownloadParams {
  /** Encrypted bytes from storage. */
  readonly encryptedData: Uint8Array;
  /** Encryption metadata from the DB record. */
  readonly metadata: BlobEncryptionMetadata;
  /** Master key for T1 decryption. Required when tier=1. */
  readonly masterKey?: KdfMasterKey;
  /** Bucket key for T2 decryption. Required when tier=2. */
  readonly bucketKey?: AeadKey;
}

/**
 * Processes a downloaded blob: decrypts the encrypted bytes.
 * Returns the original plaintext blob data.
 */
export function processDownload(params: ProcessDownloadParams): Uint8Array {
  return decryptBlob({
    encryptedData: params.encryptedData,
    metadata: params.metadata,
    masterKey: params.masterKey,
    bucketKey: params.bucketKey,
  });
}
