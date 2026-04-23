import type { GroupId, HexColor, MemberId, SystemId } from "../ids.js";
import type { ImageSource } from "../image-source.js";
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
 * - Plan 2 fleet will consume when deriving `GroupServerMetadata`.
 */
export type GroupEncryptedFields = "name" | "description" | "imageSource" | "color" | "emoji";

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
