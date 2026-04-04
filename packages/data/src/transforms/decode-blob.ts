import {
  decryptTier1,
  decryptTier2,
  deserializeEncryptedBlob,
  encryptTier1,
  encryptTier2,
  serializeEncryptedBlob,
} from "@pluralscape/crypto";

import type { AeadKey, KdfMasterKey } from "@pluralscape/crypto";
import type { BucketId } from "@pluralscape/types";

/**
 * Decode a base64-encoded T1 encrypted blob and decrypt it to plaintext.
 *
 * Flow: base64 string → Uint8Array → EncryptedBlob → decryptTier1 → plaintext
 */
export function decodeAndDecryptT1(base64: string, masterKey: KdfMasterKey): unknown {
  const bytes = base64ToUint8Array(base64);
  const blob = deserializeEncryptedBlob(bytes);
  if (blob.tier !== 1) {
    throw new Error(`Expected T1 blob, got tier ${String(blob.tier)}`);
  }
  return decryptTier1(blob, masterKey);
}

/**
 * Encrypt plaintext data as a T1 blob and encode to base64 string.
 *
 * Flow: plaintext → encryptTier1 → EncryptedBlob → Uint8Array → base64 string
 */
export function encryptAndEncodeT1(data: unknown, masterKey: KdfMasterKey): string {
  const blob = encryptTier1(data, masterKey);
  const bytes = serializeEncryptedBlob(blob);
  return uint8ArrayToBase64(bytes);
}

/** Encrypt data for a create mutation. */
export function encryptInput(data: unknown, masterKey: KdfMasterKey): { encryptedData: string } {
  return { encryptedData: encryptAndEncodeT1(data, masterKey) };
}

/** Encrypt data for an update mutation with optimistic locking. */
export function encryptUpdate(
  data: unknown,
  version: number,
  masterKey: KdfMasterKey,
): { encryptedData: string; version: number } {
  return { encryptedData: encryptAndEncodeT1(data, masterKey), version };
}

/**
 * Decode a base64-encoded T2 encrypted blob and decrypt it with a bucket key.
 */
export function decodeAndDecryptT2(base64: string, bucketKey: AeadKey): unknown {
  const bytes = base64ToUint8Array(base64);
  const blob = deserializeEncryptedBlob(bytes);
  if (blob.tier !== 2) {
    throw new Error(`Expected T2 blob, got tier ${String(blob.tier)}`);
  }
  return decryptTier2(blob, bucketKey);
}

/**
 * Encrypt plaintext data as a T2 blob and encode to base64 string.
 */
export function encryptAndEncodeT2(
  data: unknown,
  bucketKey: AeadKey,
  bucketId: BucketId,
  keyVersion?: number,
): string {
  const blob = encryptTier2(data, { bucketKey, bucketId, keyVersion });
  const bytes = serializeEncryptedBlob(blob);
  return uint8ArrayToBase64(bytes);
}

/**
 * Validate that a decrypted blob is a non-null object.
 * Returns the object cast to Record for field inspection.
 */
export function assertObjectBlob(raw: unknown, entity: string): Record<string, unknown> {
  if (raw === null || typeof raw !== "object") {
    throw new Error(`Decrypted ${entity} blob is not an object`);
  }
  return raw as Record<string, unknown>;
}

/** Validate that a field exists and is a string. */
export function assertStringField(
  obj: Record<string, unknown>,
  entity: string,
  field: string,
): void {
  if (typeof obj[field] !== "string") {
    throw new Error(`Decrypted ${entity} blob missing required string field: ${field}`);
  }
}

/** Validate that a field exists and is an array. */
export function assertArrayField(
  obj: Record<string, unknown>,
  entity: string,
  field: string,
): void {
  if (!Array.isArray(obj[field])) {
    throw new Error(`Decrypted ${entity} blob missing required array field: ${field}`);
  }
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/** Base64 encodes groups of 3 bytes into 4 characters. */
const BASE64_GROUP_SIZE = 4;

/** Convert a base64url-encoded string (no padding) to Uint8Array. */
export function base64urlToUint8Array(b64url: string): Uint8Array {
  let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (BASE64_GROUP_SIZE - (b64.length % BASE64_GROUP_SIZE)) % BASE64_GROUP_SIZE;
  b64 += "=".repeat(padLength);
  return base64ToUint8Array(b64);
}

/**
 * Extract the bucket ID from a base64-encoded T2 encrypted blob
 * without decrypting it. Parses only the blob header.
 *
 * @throws if the blob is not tier 2 or the binary data is malformed.
 */
export function extractT2BucketId(base64: string): BucketId {
  const bytes = base64ToUint8Array(base64);
  const blob = deserializeEncryptedBlob(bytes);
  if (blob.tier !== 2) {
    throw new Error(`Expected T2 blob, got tier ${String(blob.tier)}`);
  }
  return blob.bucketId;
}
