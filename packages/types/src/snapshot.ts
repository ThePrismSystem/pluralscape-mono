import type { Tag, KnownSaturationLevel } from "./identity.js";
import type {
  GroupId,
  InnerWorldEntityId,
  InnerWorldRegionId,
  LayerId,
  MemberId,
  SideSystemId,
  SubsystemId,
  SystemId,
  SystemSnapshotId,
} from "./ids.js";
import type {
  ArchitectureType,
  DiscoveryStatus,
  LayerAccessType,
  RelationshipType,
  SubsystemLayerLink,
  SubsystemMembership,
  SubsystemSideSystemLink,
  SideSystemMembership,
  SideSystemLayerLink,
  LayerMembership,
} from "./structure.js";
import type { UnixMillis } from "./timestamps.js";

// ── Snapshot metadata ─────────────────────────────────────────────

/** How a snapshot was triggered. */
export type SnapshotTrigger = "manual" | "scheduled";

/** Configurable schedule for automatic snapshots. */
export type SnapshotSchedule = "daily" | "weekly" | "disabled";

/** A point-in-time snapshot of system structure state. View-only, no revert. */
export interface SystemSnapshot {
  readonly id: SystemSnapshotId;
  readonly systemId: SystemId;
  /** User-provided name for manual snapshots. */
  readonly name: string | null;
  readonly description: string | null;
  readonly trigger: SnapshotTrigger;
  readonly createdAt: UnixMillis;
}

// ── Snapshot content (decrypted shape) ────────────────────────────

/** Text-only subset of a member for snapshot purposes (no images). */
export interface SnapshotMember {
  readonly id: MemberId;
  readonly name: string;
  readonly pronouns: readonly string[];
  readonly description: string | null;
  readonly tags: readonly Tag[];
  readonly saturationLevel: KnownSaturationLevel | null;
  readonly archived: boolean;
}

/** Snapshot of a subsystem. */
export interface SnapshotSubsystem {
  readonly id: SubsystemId;
  readonly name: string;
  readonly description: string | null;
  readonly parentSubsystemId: SubsystemId | null;
  readonly architectureType: ArchitectureType | null;
  readonly hasCore: boolean;
  readonly discoveryStatus: DiscoveryStatus;
}

/** Snapshot of a side system. */
export interface SnapshotSideSystem {
  readonly id: SideSystemId;
  readonly name: string;
  readonly description: string | null;
}

/** Snapshot of a layer. */
export interface SnapshotLayer {
  readonly id: LayerId;
  readonly name: string;
  readonly description: string | null;
  readonly accessType: LayerAccessType;
  readonly gatekeeperMemberIds: readonly MemberId[];
}

/** Snapshot of a relationship between members. */
export interface SnapshotRelationship {
  readonly sourceMemberId: MemberId;
  readonly targetMemberId: MemberId;
  readonly type: RelationshipType;
  readonly bidirectional: boolean;
  readonly label: string | null;
}

/** Snapshot of a group. */
export interface SnapshotGroup {
  readonly id: GroupId;
  readonly name: string;
  readonly description: string | null;
  readonly parentGroupId: GroupId | null;
  readonly memberIds: readonly MemberId[];
}

/** Snapshot of an innerworld region. */
export interface SnapshotInnerworldRegion {
  readonly id: InnerWorldRegionId;
  readonly name: string;
  readonly description: string | null;
  readonly parentRegionId: InnerWorldRegionId | null;
}

/** Snapshot of an innerworld entity. */
export interface SnapshotInnerworldEntity {
  readonly id: InnerWorldEntityId;
  readonly regionId: InnerWorldRegionId | null;
  readonly entityType: "member" | "landmark" | "subsystem" | "side-system" | "layer";
  readonly name: string | null;
}

/** The decrypted content of a system snapshot blob. */
export interface SnapshotContent {
  readonly members: readonly SnapshotMember[];
  readonly subsystems: readonly SnapshotSubsystem[];
  readonly sideSystems: readonly SnapshotSideSystem[];
  readonly layers: readonly SnapshotLayer[];
  readonly relationships: readonly SnapshotRelationship[];
  readonly memberships: {
    readonly subsystem: readonly SubsystemMembership[];
    readonly sideSystem: readonly SideSystemMembership[];
    readonly layer: readonly LayerMembership[];
  };
  readonly crossLinks: {
    readonly subsystemLayer: readonly SubsystemLayerLink[];
    readonly subsystemSideSystem: readonly SubsystemSideSystemLink[];
    readonly sideSystemLayer: readonly SideSystemLayerLink[];
  };
  readonly groups: readonly SnapshotGroup[];
  readonly innerworldRegions: readonly SnapshotInnerworldRegion[];
  readonly innerworldEntities: readonly SnapshotInnerworldEntity[];
}
