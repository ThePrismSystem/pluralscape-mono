import type {
  HexColor,
  MemberId,
  RelationshipId,
  SystemId,
  SystemStructureEntityAssociationId,
  SystemStructureEntityId,
  SystemStructureEntityLinkId,
  SystemStructureEntityMemberLinkId,
  SystemStructureEntityTypeId,
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

/** Shared visual properties for structure entities. */
export interface StructureVisualProps {
  readonly color: HexColor | null;
  readonly imageSource: ImageSource | null;
  readonly emoji: string | null;
}

// ── Generic structure entities ─────────────────────────────────────

/** A user-defined type of system structure entity (e.g., "Layers", "Subsystems", "Side Systems"). */
export interface SystemStructureEntityType extends AuditMetadata, StructureVisualProps {
  readonly id: SystemStructureEntityTypeId;
  readonly systemId: SystemId;
  readonly name: string;
  readonly description: string | null;
  readonly sortOrder: number;
  readonly archived: false;
}

export interface ArchivedSystemStructureEntityType extends Omit<
  SystemStructureEntityType,
  "archived"
> {
  readonly archived: true;
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

export interface ArchivedSystemStructureEntity extends Omit<SystemStructureEntity, "archived"> {
  readonly archived: true;
}

/** A parent-child hierarchy link between two structure entities. */
export interface SystemStructureEntityLink {
  readonly id: SystemStructureEntityLinkId;
  readonly systemId: SystemId;
  readonly entityId: SystemStructureEntityId;
  readonly parentEntityId: SystemStructureEntityId | null;
  readonly sortOrder: number;
  readonly createdAt: UnixMillis;
}

/** A link placing a member under a structure entity (or at root level). */
export interface SystemStructureEntityMemberLink {
  readonly id: SystemStructureEntityMemberLinkId;
  readonly systemId: SystemId;
  readonly parentEntityId: SystemStructureEntityId | null;
  readonly memberId: MemberId;
  readonly sortOrder: number;
  readonly createdAt: UnixMillis;
}

/** A many-to-many cross-type association between two structure entities. */
export interface SystemStructureEntityAssociation {
  readonly id: SystemStructureEntityAssociationId;
  readonly systemId: SystemId;
  readonly sourceEntityId: SystemStructureEntityId;
  readonly targetEntityId: SystemStructureEntityId;
  readonly createdAt: UnixMillis;
}
