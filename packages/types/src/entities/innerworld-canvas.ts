import type { EncryptedBlob } from "../encryption-primitives.js";
import type { SystemId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { Serialize } from "../type-assertions.js";

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
 * - `InnerWorldCanvasServerMetadata` (derived via `Omit`)
 */
export type InnerWorldCanvasEncryptedFields = "viewportX" | "viewportY" | "zoom" | "dimensions";

/**
 * Server-visible InnerWorldCanvas metadata — raw Drizzle row shape.
 *
 * Derived from `InnerWorldCanvas` by stripping the encrypted field keys
 * (bundled inside `encryptedData`) and adding the persistence columns
 * the domain type doesn't carry: `version`, `createdAt`, `updatedAt`,
 * and the opaque `encryptedData` blob. The canvas table uses `systemId`
 * as its primary key (one canvas per system) and has no archivable
 * lifecycle.
 */
export type InnerWorldCanvasServerMetadata = Omit<
  InnerWorldCanvas,
  InnerWorldCanvasEncryptedFields
> & {
  readonly version: number;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
  readonly encryptedData: EncryptedBlob;
};

/**
 * JSON-wire representation of an InnerWorldCanvas. Derived from the
 * domain `InnerWorldCanvas` type via `Serialize<T>`; branded IDs become
 * plain strings.
 */
export type InnerWorldCanvasWire = Serialize<InnerWorldCanvas>;
