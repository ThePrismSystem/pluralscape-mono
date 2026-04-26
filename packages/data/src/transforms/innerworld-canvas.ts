import { brandId } from "@pluralscape/types";
import { InnerWorldCanvasEncryptedInputSchema } from "@pluralscape/validation";

import { decodeAndDecryptT1, encryptUpdate } from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  InnerWorldCanvas,
  InnerWorldCanvasEncryptedInput,
  InnerWorldCanvasWire,
  SystemId,
} from "@pluralscape/types";

export function decryptCanvas(
  raw: InnerWorldCanvasWire,
  masterKey: KdfMasterKey,
): InnerWorldCanvas {
  const decrypted = decodeAndDecryptT1(raw.encryptedData, masterKey);
  const validated = InnerWorldCanvasEncryptedInputSchema.parse(decrypted);

  return {
    systemId: brandId<SystemId>(raw.systemId),
    viewportX: validated.viewportX,
    viewportY: validated.viewportY,
    zoom: validated.zoom,
    dimensions: validated.dimensions,
  };
}

export function encryptCanvasUpdate(
  data: InnerWorldCanvasEncryptedInput,
  version: number,
  masterKey: KdfMasterKey,
): { encryptedData: string; version: number } {
  return encryptUpdate(data, version, masterKey);
}
