import type { EncryptedWire } from "../encrypted-wire.js";
import type { EncryptedBlob } from "../encryption-primitives.js";
import type { GroupId, HexColor, MemberId, SystemId } from "../ids.js";
import type { ImageSource } from "../image-source.js";
import type { UnixMillis } from "../timestamps.js";
import type { Serialize } from "../type-assertions.js";
import type { Archived, AuditMetadata } from "../utility.js";

/** A user-defined group (folder) for organizing members. */
export interface Group extends AuditMetadata {
  readonly id: GroupId;
  readonly systemId: SystemId;
  readonly name: string;
  readonly description: string | null;
  readonly parentGroupId: GroupId | null;
  readonly imageSource: ImageSource | null;
  readonly color: HexColor | null;
  readonly emoji: string | null;
  readonly sortOrder: number;
  readonly archived: false;
}

/**
 * Keys of `Group` that are encrypted client-side before the server sees
 * them. Consumed by:
 * - `__sot-manifest__.ts` (manifest's `encryptedFields` slot)
 * - `scripts/openapi-wire-parity.type-test.ts` (PlaintextGroup parity)
 * - `GroupServerMetadata` (derived via `Omit`)
 */
export type GroupEncryptedFields = "name" | "description" | "imageSource" | "color" | "emoji";

// ── Canonical chain (see ADR-023) ────────────────────────────────────
// GroupEncryptedInput → GroupServerMetadata
//                    → GroupResult → GroupWire
// Per-alias JSDoc is intentionally minimal; the alias name plus the
// chain anchor above carries the meaning. Per-alias docs only appear
// when an entity diverges from the standard pattern.

export type GroupEncryptedInput = Pick<Group, GroupEncryptedFields>;

/** An archived group — preserves all data with archive metadata. */
export type ArchivedGroup = Archived<Group>;

/** Junction linking a member to a group. */
export interface GroupMembership {
  readonly groupId: GroupId;
  readonly memberId: MemberId;
}

/** Recursive tree structure for rendering nested groups. */
export type GroupTree = Group & {
  readonly children: readonly GroupTree[];
};

/** Operation to move a group to a new parent (null = root). */
export interface GroupMoveOperation {
  readonly sourceGroupId: GroupId;
  readonly targetParentGroupId: GroupId | null;
}

/**
 * Server-visible Group metadata — raw Drizzle row shape.
 *
 * Derived from `Group` by stripping the encrypted field keys bundled
 * inside `encryptedData` and `archived` (server tracks a mutable boolean
 * with a companion `archivedAt` timestamp, domain uses `false` literal).
 * Adds DB-only columns the domain type doesn't carry: `encryptedData`
 * (the T1 blob), `archived`/`archivedAt`.
 */
export type GroupServerMetadata = Omit<Group, GroupEncryptedFields | "archived"> & {
  readonly encryptedData: EncryptedBlob;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
};

export type GroupResult = EncryptedWire<GroupServerMetadata>;

export type GroupWire = Serialize<GroupResult>;
