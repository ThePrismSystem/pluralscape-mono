import {
  deserializeEncryptedBlob,
  InvalidInputError,
  serializeEncryptedBlob,
} from "@pluralscape/crypto";

import { HTTP_BAD_REQUEST } from "../http.constants.js";
import { MAX_ENCRYPTED_DATA_BYTES } from "../service.constants.js";

import { ApiHttpError } from "./api-error.js";

import type { EncryptedBase64, EncryptedBlob, T3EncryptedBytes } from "@pluralscape/types";
import type { z } from "zod/v4";

export function encryptedBlobToBase64(blob: EncryptedBlob): EncryptedBase64 {
  // Brand-construction site: the only place plain base64 is lifted to the
  // EncryptedBase64 wire brand. Mirror of `brandId` for ID brands.
  return Buffer.from(serializeEncryptedBlob(blob)).toString("base64") as EncryptedBase64;
}

/**
 * Narrow raw bytes into a `T3EncryptedBytes` brand without a double-cast
 * (mirror of `toServerSecret`). The brand is a compile-time phantom; the
 * runtime bytes are unchanged. Callers are responsible for ensuring the
 * input bytes really are server-side T3 ciphertext (per ADR-023 Class E).
 */
export function toT3EncryptedBytes(bytes: Uint8Array): T3EncryptedBytes {
  return bytes as T3EncryptedBytes;
}

export function encryptedBlobToBase64OrNull(blob: EncryptedBlob | null): EncryptedBase64 | null {
  if (blob === null) return null;
  return encryptedBlobToBase64(blob);
}

export function parseAndValidateBlob<T extends { encryptedData: string }>(
  params: unknown,
  schema: z.ZodType<T>,
  maxBytes: number,
): { parsed: T; blob: EncryptedBlob } {
  const result = schema.safeParse(params);
  if (!result.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid payload");
  }

  const rawBytes = Buffer.from(result.data.encryptedData, "base64");

  if (rawBytes.length > maxBytes) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "BLOB_TOO_LARGE",
      `encryptedData exceeds maximum size of ${String(maxBytes)} bytes`,
    );
  }

  let blob: EncryptedBlob;
  try {
    blob = deserializeEncryptedBlob(new Uint8Array(rawBytes));
  } catch (error: unknown) {
    if (error instanceof InvalidInputError) {
      throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", error.message);
    }
    throw error;
  }

  return { parsed: result.data, blob };
}

export function validateEncryptedBlob(
  base64Data: string,
  maxBytes = MAX_ENCRYPTED_DATA_BYTES,
): EncryptedBlob {
  const rawBytes = Buffer.from(base64Data, "base64");

  if (rawBytes.length > maxBytes) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "BLOB_TOO_LARGE",
      `encryptedData exceeds maximum size of ${String(maxBytes)} bytes`,
    );
  }

  try {
    return deserializeEncryptedBlob(new Uint8Array(rawBytes));
  } catch (error: unknown) {
    if (error instanceof InvalidInputError) {
      throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", error.message);
    }
    throw error;
  }
}
