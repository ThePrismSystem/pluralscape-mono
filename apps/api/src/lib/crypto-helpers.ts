import { serializeEncryptedBlob } from "@pluralscape/crypto";

import type { EncryptedBlob } from "@pluralscape/types";

export function encryptedBlobToBase64(blob: EncryptedBlob): string {
  return Buffer.from(serializeEncryptedBlob(blob)).toString("base64");
}
