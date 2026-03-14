import type {
  HexColor,
  LayerId,
  MemberId,
  RelationshipId,
  SideSystemId,
  SubsystemId,
  SystemId,
} from "./ids.js";
import type { ImageSource } from "./image-source.js";
import type { UnixMillis } from "./timestamps.js";
import type { Archived, AuditMetadata } from "./utility.js";

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

/** A relationship between two members. */
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
  readonly archived: false;
}

export type ArchivedRelationship = Archived<Relationship>;

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

/** Whether a layer is freely accessible or requires a gatekeeper. */
export type LayerAccessType = "open" | "gatekept";

/** Shared visual properties for structure entities (subsystems, side systems, layers). */
export interface StructureVisualProps {
  readonly color: HexColor | null;
  readonly imageSource: ImageSource | null;
  readonly emoji: string | null;
}

/** A nested group within a system — can contain other subsystems recursively. */
export interface Subsystem extends AuditMetadata, StructureVisualProps {
  readonly id: SubsystemId;
  readonly systemId: SystemId;
  readonly name: string;
  readonly description: string | null;
  readonly parentSubsystemId: SubsystemId | null;
  readonly architectureType: ArchitectureType | null;
  readonly hasCore: boolean;
  readonly discoveryStatus: DiscoveryStatus;
  readonly archived: false;
}

export type ArchivedSubsystem = Archived<Subsystem>;

/** A parallel group that exists alongside the main system — not nested. */
export interface SideSystem extends AuditMetadata, StructureVisualProps {
  readonly id: SideSystemId;
  readonly systemId: SystemId;
  readonly name: string;
  readonly description: string | null;
  readonly archived: false;
}

export type ArchivedSideSystem = Archived<SideSystem>;

/** Shared fields for all layer variants. */
interface LayerBase extends AuditMetadata, StructureVisualProps {
  readonly id: LayerId;
  readonly systemId: SystemId;
  readonly name: string;
  readonly description: string | null;
  readonly archived: false;
}

/** A freely accessible layer with no gatekeeper. */
export interface OpenLayer extends LayerBase {
  readonly accessType: "open";
  readonly gatekeeperMemberIds: readonly [];
}

/** A gatekept layer — zero or more members can be assigned as gatekeepers. */
export interface GatekeptLayer extends LayerBase {
  readonly accessType: "gatekept";
  readonly gatekeeperMemberIds: readonly MemberId[];
}

/** A distinct layer or region within the system's internal landscape. */
export type Layer = OpenLayer | GatekeptLayer;

export type ArchivedLayer = Archived<Layer>;

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

/** Junction linking a subsystem to a layer. */
export interface SubsystemLayerLink {
  readonly subsystemId: SubsystemId;
  readonly layerId: LayerId;
}

/** Junction linking a subsystem to a side system. */
export interface SubsystemSideSystemLink {
  readonly subsystemId: SubsystemId;
  readonly sideSystemId: SideSystemId;
}

/** Junction linking a side system to a layer. */
export interface SideSystemLayerLink {
  readonly sideSystemId: SideSystemId;
  readonly layerId: LayerId;
}
