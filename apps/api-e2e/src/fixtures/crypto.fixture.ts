/**
 * Crypto helpers for E2E tests.
 *
 * Provides functions to encrypt/decrypt member data using a test master key,
 * exercising the same codepath a real client would use.
 */
import {
  decryptTier1,
  encryptTier1,
  generateMasterKey,
  initSodium,
  serializeEncryptedBlob,
  deserializeEncryptedBlob,
} from "@pluralscape/crypto";

import type { T1EncryptedBlob } from "@pluralscape/types";

let initialized = false;
let testMasterKey: ReturnType<typeof generateMasterKey>;

/** Initialize libsodium and generate a test master key. Idempotent. */
export async function ensureCryptoReady(): Promise<void> {
  if (initialized) return;
  await initSodium();
  testMasterKey = generateMasterKey();
  initialized = true;
}

/** Encrypt a JSON payload as a T1 blob and return the base64 string the API expects. */
export function encryptForApi(data: unknown): string {
  const blob: T1EncryptedBlob = encryptTier1(data, testMasterKey);
  const binary = serializeEncryptedBlob(blob);
  return Buffer.from(binary).toString("base64");
}

/** Decrypt a base64 encryptedData string returned by the API back to the original JSON payload. */
export function decryptFromApi(base64Data: string): unknown {
  const binary = Buffer.from(base64Data, "base64");
  const blob = deserializeEncryptedBlob(new Uint8Array(binary));
  return decryptTier1(blob as T1EncryptedBlob, testMasterKey);
}
