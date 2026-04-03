import { encryptTier1, serializeEncryptedBlob } from "@pluralscape/crypto";

import type { KdfMasterKey } from "@pluralscape/crypto";

/**
 * Encrypt a payload as a T1 blob and return its base64 representation.
 * Used across transform tests to build realistic encrypted test data.
 */
export function makeBase64Blob(payload: unknown, masterKey: KdfMasterKey): string {
  const blob = encryptTier1(payload, masterKey);
  const bytes = serializeEncryptedBlob(blob);
  return toBase64(bytes);
}

/** Convert a Uint8Array to a base64 string without using Buffer. */
export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}
