import { KDF_KEY_BYTES } from "./constants.js";
import { getSodium } from "./sodium.js";
import { decryptJSON, encryptJSON } from "./symmetric.js";

import type { EncryptedPayload } from "./symmetric.js";
import type { AeadKey, AeadNonce, KdfMasterKey } from "./types.js";
import type { BucketId, T1EncryptedBlob, T2EncryptedBlob } from "@pluralscape/types";

/** KDF context for data-encryption sub-keys (must be exactly 8 bytes). */
const KDF_CONTEXT_DATA = "dataencr";

/** KDF sub-key ID for T1 data encryption. */
const SUBKEY_DATA_ENCRYPTION = 1;

/** Parameters for T2 (per-bucket) encryption. */
export interface Tier2EncryptParams {
  readonly bucketKey: AeadKey;
  readonly bucketId: BucketId;
  readonly keyVersion?: number;
}

// ── Internal helpers ───────────────────────────────────────────────

/** Derive a data-encryption sub-key from the master key via KDF. */
function deriveDataKey(masterKey: KdfMasterKey): AeadKey {
  const adapter = getSodium();
  return adapter.kdfDeriveFromKey(
    KDF_KEY_BYTES,
    SUBKEY_DATA_ENCRYPTION,
    KDF_CONTEXT_DATA,
    masterKey,
  ) as AeadKey;
}

/** Construct a T1EncryptedBlob from an EncryptedPayload. */
function buildT1Blob(payload: EncryptedPayload): T1EncryptedBlob {
  return {
    ciphertext: payload.ciphertext,
    nonce: payload.nonce,
    tier: 1,
    algorithm: "xchacha20-poly1305",
    keyVersion: null,
    bucketId: null,
  };
}

/** Construct a T2EncryptedBlob from an EncryptedPayload and bucket metadata. */
function buildT2Blob(
  payload: EncryptedPayload,
  bucketId: BucketId,
  keyVersion: number | null,
): T2EncryptedBlob {
  return {
    ciphertext: payload.ciphertext,
    nonce: payload.nonce,
    tier: 2,
    algorithm: "xchacha20-poly1305",
    keyVersion,
    bucketId,
  };
}

/** Extract an EncryptedPayload from a blob, casting nonce to AeadNonce. */
function blobToPayload(blob: T1EncryptedBlob | T2EncryptedBlob): EncryptedPayload {
  // Safe cast: blob-codec.ts validates nonce length on deserialization,
  // and our buildT*Blob functions produce correct nonces from encryptJSON.
  return {
    ciphertext: blob.ciphertext,
    nonce: blob.nonce as AeadNonce,
  };
}

// ── T1: Zero-knowledge encryption (master key) ────────────────────

/** Encrypt data with the system master key (T1 zero-knowledge). */
export function encryptTier1(data: unknown, masterKey: KdfMasterKey): T1EncryptedBlob {
  const adapter = getSodium();
  const dataKey = deriveDataKey(masterKey);
  try {
    return buildT1Blob(encryptJSON(data, dataKey));
  } finally {
    adapter.memzero(dataKey);
  }
}

/** Decrypt a T1 blob using the system master key. */
export function decryptTier1(blob: T1EncryptedBlob, masterKey: KdfMasterKey): unknown {
  const adapter = getSodium();
  const dataKey = deriveDataKey(masterKey);
  try {
    return decryptJSON(blobToPayload(blob), dataKey);
  } finally {
    adapter.memzero(dataKey);
  }
}

// ── T2: Per-bucket encryption ──────────────────────────────────────

/** Encrypt data with a bucket-specific key (T2 per-bucket). */
export function encryptTier2(data: unknown, params: Tier2EncryptParams): T2EncryptedBlob {
  const payload = encryptJSON(data, params.bucketKey);
  return buildT2Blob(payload, params.bucketId, params.keyVersion ?? null);
}

/** Decrypt a T2 blob using the bucket key. */
export function decryptTier2(blob: T2EncryptedBlob, bucketKey: AeadKey): unknown {
  return decryptJSON(blobToPayload(blob), bucketKey);
}

// ── T3: Plaintext passthrough ──────────────────────────────────────

/** Identity passthrough for T3 plaintext metadata (type-safe marker). */
export function wrapTier3<T>(data: T): T {
  return data;
}

// ── Batch operations ───────────────────────────────────────────────

/** Encrypt an array of items with the master key (T1). Derives key once. */
export function encryptTier1Batch(
  items: readonly unknown[],
  masterKey: KdfMasterKey,
): T1EncryptedBlob[] {
  if (items.length === 0) return [];
  const adapter = getSodium();
  const dataKey = deriveDataKey(masterKey);
  try {
    return items.map((item) => buildT1Blob(encryptJSON(item, dataKey)));
  } finally {
    adapter.memzero(dataKey);
  }
}

/** Decrypt an array of T1 blobs. Derives key once. */
export function decryptTier1Batch(
  blobs: readonly T1EncryptedBlob[],
  masterKey: KdfMasterKey,
): unknown[] {
  if (blobs.length === 0) return [];
  const adapter = getSodium();
  const dataKey = deriveDataKey(masterKey);
  try {
    return blobs.map((blob) => decryptJSON(blobToPayload(blob), dataKey));
  } finally {
    adapter.memzero(dataKey);
  }
}

/** Encrypt an array of items with a bucket key (T2). */
export function encryptTier2Batch(
  items: readonly unknown[],
  params: Tier2EncryptParams,
): T2EncryptedBlob[] {
  return items.map((item) => encryptTier2(item, params));
}

/** Decrypt an array of T2 blobs. */
export function decryptTier2Batch(
  blobs: readonly T2EncryptedBlob[],
  bucketKey: AeadKey,
): unknown[] {
  return blobs.map((blob) => decryptTier2(blob, bucketKey));
}
