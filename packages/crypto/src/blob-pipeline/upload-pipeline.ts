import { getSodium } from "../sodium.js";

import { validateBlobContentType } from "./content-validation.js";
import { encryptBlob } from "./encrypt-blob.js";

import type { AeadKey, KdfMasterKey } from "../types.js";
import type { BlobEncryptionMetadata } from "./blob-encryption-metadata.js";
import type { BlobPurpose, BucketId } from "@pluralscape/types";

/** SHA-256 hash output length. */
const SHA256_HEX_LENGTH = 64;

/** Parameters for preparing a blob upload. */
export interface PrepareUploadParams {
  /** Raw blob bytes. */
  readonly data: Uint8Array;
  /** The intended purpose of this blob. */
  readonly purpose: BlobPurpose;
  /** MIME type of the blob. */
  readonly mimeType: string;
  /** Encryption tier: 1 = master key, 2 = bucket key. */
  readonly tier: 1 | 2;
  /** Master key for T1 encryption. Required when tier=1. */
  readonly masterKey?: KdfMasterKey;
  /** Bucket key for T2 encryption. Required when tier=2. */
  readonly bucketKey?: AeadKey;
  /** Bucket ID for T2 encryption. Required when tier=2. */
  readonly bucketId?: BucketId;
}

/** Result of preparing a blob for upload. */
export interface PreparedBlobUpload {
  /** Encrypted bytes ready for storage. */
  readonly encryptedData: Uint8Array;
  /** SHA-256 hex checksum of the encrypted bytes. */
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
 * 3. Computes SHA-256 checksum of encrypted bytes
 * 4. Returns prepared upload ready for storage
 */
export function prepareUpload(params: PrepareUploadParams): PreparedBlobUpload {
  // Step 1: Validate content type
  validateBlobContentType(params.mimeType, params.purpose);

  // Step 2: Encrypt
  const { encryptedData, metadata } = encryptBlob({
    data: params.data,
    tier: params.tier,
    masterKey: params.masterKey,
    bucketKey: params.bucketKey,
    bucketId: params.bucketId,
  });

  // Step 3: Checksum of encrypted bytes
  const checksum = computeSha256Hex(encryptedData);

  return {
    encryptedData,
    checksum,
    encryptionMetadata: metadata,
    encryptedSizeBytes: encryptedData.byteLength,
  };
}

/** Compute SHA-256 hex digest of data using libsodium's genericHash. */
function computeSha256Hex(data: Uint8Array): string {
  const adapter = getSodium();
  // genericHash with 32 bytes output = SHA-256 equivalent strength
  const HASH_BYTES = 32;
  const hash = adapter.genericHash(HASH_BYTES, data);
  return bytesToHex(hash);
}

/** Convert bytes to hex string. */
function bytesToHex(bytes: Uint8Array): string {
  const HEX_BASE = 16;
  const PAD_LENGTH = 2;
  const parts: string[] = [];
  for (const byte of bytes) {
    parts.push(byte.toString(HEX_BASE).padStart(PAD_LENGTH, "0"));
  }
  const hex = parts.join("");
  if (hex.length !== SHA256_HEX_LENGTH) {
    throw new Error(`Expected ${String(SHA256_HEX_LENGTH)} hex chars, got ${String(hex.length)}.`);
  }
  return hex;
}
