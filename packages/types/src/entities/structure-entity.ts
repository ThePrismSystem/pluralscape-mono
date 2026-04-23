import type {
  HexColor,
  SystemId,
  SystemStructureEntityId,
  SystemStructureEntityTypeId,
} from "../ids.js";
import type { ImageSource } from "../image-source.js";
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
 * - Plan 2 fleet will consume when deriving
 *   `SystemStructureEntityServerMetadata`.
 */
export type SystemStructureEntityEncryptedFields =
  | "name"
  | "description"
  | "color"
  | "imageSource"
  | "emoji";

export type ArchivedSystemStructureEntity = Archived<SystemStructureEntity>;
