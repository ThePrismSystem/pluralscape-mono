import type { EncryptedBlob } from "../encryption-primitives.js";
import type {
  GroupId,
  InnerWorldEntityId,
  InnerWorldRegionId,
  MemberId,
  SystemId,
  SystemSnapshotId,
  SystemStructureEntityId,
  SystemStructureEntityTypeId,
} from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { Serialize } from "../type-assertions.js";
import type { InnerWorldEntityType } from "./innerworld-entity.js";
import type { Tag, SaturationLevel } from "./member.js";
import type { RelationshipType } from "./relationship.js";
import type { SystemStructureEntityAssociation } from "./structure-entity-association.js";
import type { SystemStructureEntityLink } from "./structure-entity-link.js";
import type { SystemStructureEntityMemberLink } from "./structure-entity-member-link.js";

// ── Snapshot metadata ─────────────────────────────────────────────

/** How a snapshot was triggered. */
export type SnapshotTrigger = "manual" | "scheduled-daily" | "scheduled-weekly";

/** Configurable schedule for automatic snapshots. */
export type SnapshotSchedule = "daily" | "weekly" | "disabled";

/** A point-in-time snapshot of system structure state. View-only, no revert. */
export interface SystemSnapshot {
  readonly id: SystemSnapshotId;
  readonly systemId: SystemId;
  readonly trigger: SnapshotTrigger;
  readonly createdAt: UnixMillis;
}

/**
 * Server-visible SystemSnapshot metadata — raw Drizzle row shape.
 *
 * SystemSnapshot is a hybrid entity: it carries plaintext metadata
 * (id, systemId, createdAt) plus an opaque `encryptedData` column that
 * stores the T1-encrypted `SnapshotContent` — which lives in its own
 * type (not as a keys-subset of `SystemSnapshot`), so no
 * `SystemSnapshotEncryptedFields` union exists. Replaces the domain's
 * `trigger` with the DB column's `snapshotTrigger` name.
 */
export type SystemSnapshotServerMetadata = Omit<SystemSnapshot, "trigger"> & {
  readonly snapshotTrigger: SnapshotTrigger;
  readonly encryptedData: EncryptedBlob;
};

/**
 * JSON-wire representation of SystemSnapshot. Derived from the domain
 * `SystemSnapshot` type via `Serialize<T>`; branded IDs become plain
 * strings, `UnixMillis` becomes `number`.
 */
export type SystemSnapshotWire = Serialize<SystemSnapshot>;

// ── Snapshot content (decrypted shape) ────────────────────────────

/** Text-only subset of a member for snapshot purposes (no images). */
export interface SnapshotMember {
  readonly id: MemberId;
  readonly name: string;
  readonly pronouns: readonly string[];
  readonly description: string | null;
  readonly tags: readonly Tag[];
  readonly saturationLevel: SaturationLevel | null;
  readonly archived: boolean;
}

/** Snapshot of a structure entity type. */
export interface SnapshotStructureEntityType {
  readonly id: SystemStructureEntityTypeId;
  readonly name: string;
  readonly description: string | null;
}

/** Snapshot of a structure entity. */
export interface SnapshotStructureEntity {
  readonly id: SystemStructureEntityId;
  readonly entityTypeId: SystemStructureEntityTypeId;
  readonly name: string;
  readonly description: string | null;
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
  readonly entityType: InnerWorldEntityType;
  readonly name: string | null;
}

/**
 * The decrypted content of a system snapshot blob.
 *
 * Class C auxiliary type per ADR-023 — the SoT manifest's `encryptedInput`
 * slot for `SystemSnapshot` points at this type directly (no alias).
 * Parity gate: `SnapshotContentSchema` in `packages/validation/src/snapshot.ts`.
 */
export interface SnapshotContent {
  readonly name: string | null;
  readonly description: string | null;
  readonly members: readonly SnapshotMember[];
  readonly structureEntityTypes: readonly SnapshotStructureEntityType[];
  readonly structureEntities: readonly SnapshotStructureEntity[];
  // TODO(types-8f84): replace SystemStructure* with Snapshot* projections
  // (omits server-shaped systemId / createdAt) per the snapshot-projection
  // convention used by SnapshotMember/Group/Region above.
  readonly structureEntityLinks: readonly SystemStructureEntityLink[];
  readonly structureEntityMemberLinks: readonly SystemStructureEntityMemberLink[];
  readonly structureEntityAssociations: readonly SystemStructureEntityAssociation[];
  readonly relationships: readonly SnapshotRelationship[];
  readonly groups: readonly SnapshotGroup[];
  readonly innerworldRegions: readonly SnapshotInnerworldRegion[];
  readonly innerworldEntities: readonly SnapshotInnerworldEntity[];
}
