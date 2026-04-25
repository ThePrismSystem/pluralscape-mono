import type { EncryptedWire } from "../encrypted-wire.js";
import type { EncryptedBlob } from "../encryption-primitives.js";
import type {
  HexColor,
  SystemId,
  SystemStructureEntityId,
  SystemStructureEntityTypeId,
} from "../ids.js";
import type { ImageSource } from "../image-source.js";
import type { UnixMillis } from "../timestamps.js";
import type { Serialize } from "../type-assertions.js";
import type { Archived, AuditMetadata } from "../utility.js";
import type { ArchitectureType } from "./structure-entity-type.js";

/** How a member or the system itself originated. */
export type OriginType =
  | "traumagenic"
  | "endogenic"
  | "mixed-origin"
  | "quoigenic"
  | "prefer-not-to-say"
  | "custom";

/** How much of the system has been discovered or mapped. */
export type DiscoveryStatus = "fully-mapped" | "partially-mapped" | "unknown";

/** A system's self-described structural profile. */
export interface SystemProfile {
  readonly architecture: ArchitectureType | null;
  readonly origin: OriginType | null;
  readonly discoveryStatus: DiscoveryStatus;
  readonly hasCore: boolean;
}

/** Shared visual properties for structure entities. */
export interface StructureVisualProps {
  readonly color: HexColor | null;
  readonly imageSource: ImageSource | null;
  readonly emoji: string | null;
}

/** An instance of a system structure entity type. */
export interface SystemStructureEntity extends AuditMetadata, StructureVisualProps {
  readonly id: SystemStructureEntityId;
  readonly systemId: SystemId;
  readonly entityTypeId: SystemStructureEntityTypeId;
  readonly name: string;
  readonly description: string | null;
  readonly sortOrder: number;
  readonly archived: false;
}

/**
 * Keys of `SystemStructureEntity` that are encrypted client-side before
 * the server sees them. Consumed by:
 * - `__sot-manifest__.ts` (manifest's `encryptedFields` slot)
 * - `scripts/openapi-wire-parity.type-test.ts` (PlaintextStructureEntity parity)
 * - `SystemStructureEntityServerMetadata` (derived via `Omit`)
 */
export type SystemStructureEntityEncryptedFields =
  | "name"
  | "description"
  | "color"
  | "imageSource"
  | "emoji";

/**
 * Pre-encryption shape — what `encryptStructureEntityInput` accepts. Single source
 * of truth: derived from `SystemStructureEntity` via `Pick<>` over the encrypted-keys union.
 */
export type SystemStructureEntityEncryptedInput = Pick<
  SystemStructureEntity,
  SystemStructureEntityEncryptedFields
>;

export type ArchivedSystemStructureEntity = Archived<SystemStructureEntity>;

/**
 * Server-visible SystemStructureEntity metadata — raw Drizzle row shape.
 *
 * Derived from `SystemStructureEntity` by stripping the encrypted field
 * keys (bundled inside `encryptedData`) and `archived` (the domain literal
 * `false` becomes a mutable boolean at the DB layer, paired with an
 * `archivedAt` timestamp). The server sees everything in the domain type
 * EXCEPT the encrypted keys, plus `encryptedData` + archive metadata.
 */
export type SystemStructureEntityServerMetadata = Omit<
  SystemStructureEntity,
  SystemStructureEntityEncryptedFields | "archived"
> & {
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly encryptedData: EncryptedBlob;
};

/**
 * Server-emit shape — what `toStructureEntityResult` returns. Branded IDs and
 * timestamps preserved; `encryptedData` is wire-form `EncryptedBase64`.
 */
export type SystemStructureEntityResult = EncryptedWire<SystemStructureEntityServerMetadata>;

/**
 * JSON-serialized wire form of `SystemStructureEntityResult`: branded IDs become plain strings;
 * `EncryptedBase64` becomes plain `string`; timestamps become numbers.
 */
export type SystemStructureEntityWire = Serialize<SystemStructureEntityResult>;
