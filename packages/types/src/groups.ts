import type { BlobId, GroupId, MemberId, SystemId } from "./ids.js";
import type { UnixMillis } from "./timestamps.js";
import type { AuditMetadata } from "./utility.js";

/** A user-defined group (folder) for organizing members. */
export interface Group extends AuditMetadata {
  readonly id: GroupId;
  readonly systemId: SystemId;
  readonly name: string;
  readonly description: string | null;
  readonly parentGroupId: GroupId | null;
  readonly imageRef: BlobId | null;
  readonly color: string | null;
  readonly emoji: string | null;
  readonly sortOrder: number;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
}

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
