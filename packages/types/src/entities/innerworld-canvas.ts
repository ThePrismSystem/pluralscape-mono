import type { SystemId } from "../ids.js";

/** The viewport state for the innerworld canvas. */
export interface InnerWorldCanvas {
  readonly systemId: SystemId;
  readonly viewportX: number;
  readonly viewportY: number;
  readonly zoom: number;
  readonly dimensions: { readonly width: number; readonly height: number };
}

/**
 * Keys of `InnerWorldCanvas` that are encrypted client-side before the
 * server sees them. `systemId` is a route parameter (not in the request
 * body) and is intentionally excluded. Consumed by:
 * - `__sot-manifest__.ts` (manifest's `encryptedFields` slot)
 * - `scripts/openapi-wire-parity.type-test.ts` (PlaintextInnerworldCanvas parity)
 * - Plan 2 fleet will consume when deriving
 *   `InnerWorldCanvasServerMetadata`.
 */
export type InnerWorldCanvasEncryptedFields = "viewportX" | "viewportY" | "zoom" | "dimensions";
