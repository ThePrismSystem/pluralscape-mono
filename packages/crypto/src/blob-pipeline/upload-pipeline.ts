import { getSodium } from "../sodium.js";

import { validateBlobContentType } from "./content-validation.js";
import { encryptBlob } from "./encrypt-blob.js";

import type { AeadKey, KdfMasterKey } from "../types.js";
import type { BlobEncryptionMetadata } from "./blob-encryption-metadata.js";
import type { BlobPurpose, BucketId } from "@pluralscape/types";

/** BLAKE2b-256 hash output as hex is 64 characters. */
const BLAKE2B_32_HEX_LENGTH = 64;

/** Parameters for preparing a blob upload. */
export type PrepareUploadParams =
  | {
      readonly data: Uint8Array;
      readonly purpose: BlobPurpose;
      readonly mimeType: string;
      readonly tier: 1;
      readonly masterKey: KdfMasterKey;
    }
  | {
      readonly data: Uint8Array;
      readonly purpose: BlobPurpose;
      readonly mimeType: string;
      readonly tier: 2;
      readonly bucketKey: AeadKey;
      readonly bucketId: BucketId;
    };

/** Result of preparing a blob for upload. */
export interface PreparedBlobUpload {
  /** Encrypted bytes ready for storage. */
  readonly encryptedData: Uint8Array;
  /** BLAKE2b-256 hex checksum of the encrypted bytes. */
  readonly checksum: string;
  /** Encryption metadata for the DB record. */
  readonly encryptionMetadata: BlobEncryptionMetadata;
  /** Size of the encrypted data in bytes. */
  readonly encryptedSizeBytes: number;
}

/**
 * Orchestrates the client-side blob upload pipeline:
 * 1. Validates content type against purpose
 * 2. Encrypts the blob
 * 3. Computes BLAKE2b-256 checksum of encrypted bytes
 * 4. Returns prepared upload ready for storage
 */
export function prepareUpload(params: PrepareUploadParams): PreparedBlobUpload {
  validateBlobContentType(params.mimeType, params.purpose);

  const encryptParams =
    params.tier === 1
      ? ({ data: params.data, tier: 1, masterKey: params.masterKey } as const)
      : ({
          data: params.data,
          tier: 2,
          bucketKey: params.bucketKey,
          bucketId: params.bucketId,
        } as const);

  const { encryptedData, metadata } = encryptBlob(encryptParams);

  const checksum = computeBlake2bHex(encryptedData);

  return {
    encryptedData,
    checksum,
    encryptionMetadata: metadata,
    encryptedSizeBytes: encryptedData.byteLength,
  };
}

/** Compute BLAKE2b-256 hex digest of data using libsodium's genericHash. */
function computeBlake2bHex(data: Uint8Array): string {
  const adapter = getSodium();
  const HASH_BYTES = 32;
  const hash = adapter.genericHash(HASH_BYTES, data);
  const hex = bytesToHex(hash);
  if (hex.length !== BLAKE2B_32_HEX_LENGTH) {
    throw new Error(
      `Expected ${String(BLAKE2B_32_HEX_LENGTH)} hex chars, got ${String(hex.length)}.`,
    );
  }
  return hex;
}

/** Convert bytes to hex string. */
function bytesToHex(bytes: Uint8Array): string {
  const HEX_BASE = 16;
  const PAD_LENGTH = 2;
  return Array.from(bytes, (b) => b.toString(HEX_BASE).padStart(PAD_LENGTH, "0")).join("");
}
