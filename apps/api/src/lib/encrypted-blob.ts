import {
  deserializeEncryptedBlob,
  InvalidInputError,
  serializeEncryptedBlob,
} from "@pluralscape/crypto";

import { HTTP_BAD_REQUEST } from "../http.constants.js";

import { ApiHttpError } from "./api-error.js";

import type { EncryptedBlob } from "@pluralscape/types";
import type { z } from "zod/v4";

export function encryptedBlobToBase64(blob: EncryptedBlob): string {
  return Buffer.from(serializeEncryptedBlob(blob)).toString("base64");
}

export function encryptedBlobToBase64OrNull(blob: EncryptedBlob | null): string | null {
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
  } catch (error) {
    if (error instanceof InvalidInputError) {
      throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", error.message);
    }
    throw error;
  }

  return { parsed: result.data, blob };
}
