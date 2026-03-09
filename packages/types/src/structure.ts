import type {
  LayerId,
  MemberId,
  RelationshipId,
  SideSystemId,
  SubsystemId,
  SystemId,
} from "./ids.js";
import type { UnixMillis } from "./timestamps.js";
import type { AuditMetadata } from "./utility.js";

/** The kind of relationship between two members. */
export type RelationshipType =
  | "split-from"
  | "fused-from"
  | "sibling"
  | "partner"
  | "parent-child"
  | "protector-of"
  | "caretaker-of"
  | "gatekeeper-of"
  | "source"
  | "custom";

/** An immutable relationship between two members. Created or deleted, never updated. */
export interface Relationship {
  readonly id: RelationshipId;
  readonly systemId: SystemId;
  readonly sourceMemberId: MemberId;
  readonly targetMemberId: MemberId;
  readonly type: RelationshipType;
  /** User-defined label — only meaningful when type is "custom". */
  readonly label: string | null;
  readonly bidirectional: boolean;
  readonly createdAt: UnixMillis;
}

/** High-level architectural pattern of a system's internal structure. */
export type ArchitectureType = "orbital" | "compartmentalized" | "webbed" | "mixed";

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
}

/** Whether a layer is freely accessible or requires a gatekeeper. */
export type LayerAccessType = "open" | "gatekept";

/** A nested group within a system — can contain other subsystems recursively. */
export interface Subsystem extends AuditMetadata {
  readonly id: SubsystemId;
  readonly systemId: SystemId;
  readonly name: string;
  readonly description: string | null;
  readonly parentSubsystemId: SubsystemId | null;
}

/** A parallel group that exists alongside the main system — not nested. */
export interface SideSystem extends AuditMetadata {
  readonly id: SideSystemId;
  readonly systemId: SystemId;
  readonly name: string;
  readonly description: string | null;
}

/** Shared fields for all layer variants. */
interface LayerBase extends AuditMetadata {
  readonly id: LayerId;
  readonly systemId: SystemId;
  readonly name: string;
  readonly description: string | null;
}

/** A freely accessible layer with no gatekeeper. */
export interface OpenLayer extends LayerBase {
  readonly accessType: "open";
  readonly gatekeeperMemberId: null;
}

/** A gatekept layer requiring a specific member to grant access. */
export interface GatekeptLayer extends LayerBase {
  readonly accessType: "gatekept";
  readonly gatekeeperMemberId: MemberId;
}

/** A distinct layer or region within the system's internal landscape. */
export type Layer = OpenLayer | GatekeptLayer;

/** Junction linking a member to a subsystem. */
export interface SubsystemMembership {
  readonly subsystemId: SubsystemId;
  readonly memberId: MemberId;
}

/** Junction linking a member to a side system. */
export interface SideSystemMembership {
  readonly sideSystemId: SideSystemId;
  readonly memberId: MemberId;
}

/** Junction linking a member to a layer. */
export interface LayerMembership {
  readonly layerId: LayerId;
  readonly memberId: MemberId;
}
