import { deserializeEncryptedBlob, InvalidInputError } from "@pluralscape/crypto";

import { HTTP_BAD_REQUEST } from "../http.constants.js";
import { MAX_ENCRYPTED_DATA_BYTES } from "../routes/systems/systems.constants.js";

import { ApiHttpError } from "./api-error.js";

import type { EncryptedBlob } from "@pluralscape/types";

export function validateEncryptedBlob(base64Data: string): EncryptedBlob {
  const rawBytes = Buffer.from(base64Data, "base64");

  if (rawBytes.length > MAX_ENCRYPTED_DATA_BYTES) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "BLOB_TOO_LARGE",
      `encryptedData exceeds maximum size of ${String(MAX_ENCRYPTED_DATA_BYTES)} bytes`,
    );
  }

  try {
    return deserializeEncryptedBlob(new Uint8Array(rawBytes));
  } catch (error) {
    if (error instanceof InvalidInputError) {
      throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", error.message);
    }
    throw error;
  }
}
