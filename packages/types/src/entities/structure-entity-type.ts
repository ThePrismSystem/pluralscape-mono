import type { EncryptedWire } from "../encrypted-wire.js";
import type { EncryptedBlob } from "../encryption-primitives.js";
import type { SystemId, SystemStructureEntityTypeId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { Serialize } from "../type-assertions.js";
import type { Archived, AuditMetadata } from "../utility.js";
import type { StructureVisualProps } from "./structure-entity.js";

/** Well-known architectural patterns for a system's internal structure. */
export type KnownArchitectureType =
  | "orbital"
  | "spectrum"
  | "median"
  | "age-sliding"
  | "webbed"
  | "unknown"
  | "fluid";

/** Architecture type — either a well-known pattern or a user-defined custom type. */
export type ArchitectureType =
  | { readonly kind: "known"; readonly type: KnownArchitectureType }
  | { readonly kind: "custom"; readonly value: string };

/** A user-defined type of system structure entity (e.g., "Layers", "Subsystems", "Side Systems"). */
export interface SystemStructureEntityType extends AuditMetadata, StructureVisualProps {
  readonly id: SystemStructureEntityTypeId;
  readonly systemId: SystemId;
  readonly name: string;
  readonly description: string | null;
  readonly sortOrder: number;
  readonly archived: false;
}

/**
 * Keys of `SystemStructureEntityType` that are encrypted client-side before
 * the server sees them. Consumed by:
 * - `__sot-manifest__.ts` (manifest's `encryptedFields` slot)
 * - `scripts/openapi-wire-parity.type-test.ts` (PlaintextStructureEntityType parity)
 * - `SystemStructureEntityTypeServerMetadata` (derived via `Omit`)
 */
export type SystemStructureEntityTypeEncryptedFields =
  | "name"
  | "description"
  | "color"
  | "imageSource"
  | "emoji";

/**
 * Pre-encryption shape — what `encryptSystemStructureEntityTypeInput` accepts. Single source
 * of truth: derived from `SystemStructureEntityType` via `Pick<>` over the encrypted-keys union.
 */
export type SystemStructureEntityTypeEncryptedInput = Pick<
  SystemStructureEntityType,
  SystemStructureEntityTypeEncryptedFields
>;

export type ArchivedSystemStructureEntityType = Archived<SystemStructureEntityType>;

/**
 * Server-visible SystemStructureEntityType metadata — raw Drizzle row shape.
 *
 * Derived from `SystemStructureEntityType` by stripping the encrypted field
 * keys (bundled inside `encryptedData`) and `archived` (the domain literal
 * `false` becomes a mutable boolean at the DB layer, paired with an
 * `archivedAt` timestamp). The server sees everything in the domain type
 * EXCEPT the encrypted keys, plus `encryptedData` + archive metadata.
 */
export type SystemStructureEntityTypeServerMetadata = Omit<
  SystemStructureEntityType,
  SystemStructureEntityTypeEncryptedFields | "archived"
> & {
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly encryptedData: EncryptedBlob;
};

/**
 * Server-emit shape — what `toSystemStructureEntityTypeResult` returns. Branded IDs and
 * timestamps preserved; `encryptedData` is wire-form `EncryptedBase64`.
 */
export type SystemStructureEntityTypeResult =
  EncryptedWire<SystemStructureEntityTypeServerMetadata>;

/**
 * JSON-serialized wire form of `SystemStructureEntityTypeResult`: branded IDs become plain strings;
 * `EncryptedBase64` becomes plain `string`; timestamps become numbers.
 */
export type SystemStructureEntityTypeWire = Serialize<SystemStructureEntityTypeResult>;
