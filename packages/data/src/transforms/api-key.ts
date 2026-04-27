import { ApiKeyEncryptedPayloadSchema } from "@pluralscape/validation";
import { z } from "zod/v4";

import { decodeAndDecryptT1, encryptInput } from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type { ApiKeyEncryptedPayload } from "@pluralscape/types";

/**
 * Decrypt a base64-encoded T1 blob carrying an `ApiKeyEncryptedPayload`.
 * Validates the wire shape and converts `publicKey` (crypto variant) from
 * base64 string back to `Uint8Array` via the codec.
 */
export function decryptApiKeyPayload(
  encryptedData: string,
  masterKey: KdfMasterKey,
): ApiKeyEncryptedPayload {
  const wire = decodeAndDecryptT1(encryptedData, masterKey);
  return ApiKeyEncryptedPayloadSchema.parse(wire);
}

/**
 * Encrypt an `ApiKeyEncryptedPayload` to a base64-encoded T1 blob. Converts
 * `publicKey` (crypto variant) from `Uint8Array` to base64 string before
 * JSON-stringifying inside the AEAD plaintext.
 */
export function encryptApiKeyPayload(
  payload: ApiKeyEncryptedPayload,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  const wire = z.encode(ApiKeyEncryptedPayloadSchema, payload);
  return encryptInput(wire, masterKey);
}
