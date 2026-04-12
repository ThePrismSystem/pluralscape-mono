import { assertObjectBlob, decodeAndDecryptT1, encryptUpdate } from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type { SystemId, UnixMillis } from "@pluralscape/types";
import type { InnerWorldCanvas } from "@pluralscape/types";

// ── Wire type (API response shape) ──────────────────────────────────

export interface CanvasRaw {
  readonly systemId: SystemId;
  readonly encryptedData: string;
  readonly version: number;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

// ── Decrypted output type ───────────────────────────────────────────

export type CanvasDecrypted = InnerWorldCanvas;

// ── Encrypted payload ───────────────────────────────────────────────

export interface CanvasEncryptedFields {
  readonly viewportX: number;
  readonly viewportY: number;
  readonly zoom: number;
  readonly dimensions: { readonly width: number; readonly height: number };
}

/** Compile-time check: encrypted fields must be a subset of the domain type. */
export type AssertCanvasFieldsSubset =
  CanvasEncryptedFields extends Pick<InnerWorldCanvas, keyof CanvasEncryptedFields> ? true : never;

// ── Validators ──────────────────────────────────────────────────────

function assertCanvasEncryptedFields(raw: unknown): asserts raw is CanvasEncryptedFields {
  const obj = assertObjectBlob(raw, "innerworldCanvas");
  if (typeof obj["viewportX"] !== "number") {
    throw new Error("Decrypted innerworldCanvas blob missing required number field: viewportX");
  }
  if (typeof obj["viewportY"] !== "number") {
    throw new Error("Decrypted innerworldCanvas blob missing required number field: viewportY");
  }
  if (typeof obj["zoom"] !== "number") {
    throw new Error("Decrypted innerworldCanvas blob missing required number field: zoom");
  }
  const dims = obj["dimensions"];
  if (dims === null || typeof dims !== "object") {
    throw new Error("Decrypted innerworldCanvas blob missing required object field: dimensions");
  }
  const dimsRec = dims as Record<string, unknown>;
  if (typeof dimsRec["width"] !== "number") {
    throw new Error(
      "Decrypted innerworldCanvas blob dimensions missing required number field: width",
    );
  }
  if (typeof dimsRec["height"] !== "number") {
    throw new Error(
      "Decrypted innerworldCanvas blob dimensions missing required number field: height",
    );
  }
}

// ── Transforms ──────────────────────────────────────────────────────

export function decryptCanvas(raw: CanvasRaw, masterKey: KdfMasterKey): CanvasDecrypted {
  const plaintext = decodeAndDecryptT1(raw.encryptedData, masterKey);
  assertCanvasEncryptedFields(plaintext);

  return {
    systemId: raw.systemId,
    viewportX: plaintext.viewportX,
    viewportY: plaintext.viewportY,
    zoom: plaintext.zoom,
    dimensions: plaintext.dimensions,
  };
}

export function encryptCanvasUpdate(
  data: CanvasEncryptedFields,
  version: number,
  masterKey: KdfMasterKey,
): { encryptedData: string; version: number } {
  return encryptUpdate(data, version, masterKey);
}
