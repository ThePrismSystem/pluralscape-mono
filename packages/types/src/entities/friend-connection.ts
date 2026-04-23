import type { AccountId, BucketId, FriendConnectionId } from "../ids.js";
import type { Archived, AuditMetadata } from "../utility.js";

/** Status of a friend connection between two systems. */
export type FriendConnectionStatus = "pending" | "accepted" | "blocked" | "removed";

/** Per-friend visibility toggles — controls what a friend can see beyond bucket access. */
export interface FriendVisibilitySettings {
  readonly showMembers: boolean;
  readonly showGroups: boolean;
  readonly showStructure: boolean;
  readonly allowFrontingNotifications: boolean;
}

/** A mutable friend connection between two accounts. */
export interface FriendConnection extends AuditMetadata {
  readonly id: FriendConnectionId;
  readonly accountId: AccountId;
  readonly friendAccountId: AccountId;
  readonly status: FriendConnectionStatus;
  readonly assignedBucketIds: readonly BucketId[];
  readonly visibility: FriendVisibilitySettings;
  readonly archived: false;
}

/** An archived friend connection. */
export type ArchivedFriendConnection = Archived<FriendConnection>;

/** A junction mapping a friend connection to a privacy bucket. */
export interface FriendBucketAssignment {
  readonly friendConnectionId: FriendConnectionId;
  readonly bucketId: BucketId;
}
