import type { SystemId, SystemStructureEntityTypeId } from "../ids.js";
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

export type ArchivedSystemStructureEntityType = Archived<SystemStructureEntityType>;
