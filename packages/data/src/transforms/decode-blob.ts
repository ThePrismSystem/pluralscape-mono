import {
  decryptTier1,
  deserializeEncryptedBlob,
  encryptTier1,
  serializeEncryptedBlob,
} from "@pluralscape/crypto";

import type { KdfMasterKey } from "@pluralscape/crypto";

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

function base64ToUint8Array(base64: string): Uint8Array {
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
