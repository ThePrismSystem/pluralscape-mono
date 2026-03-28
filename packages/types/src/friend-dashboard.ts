import type {
  AccountId,
  BucketId,
  CustomFrontId,
  FriendConnectionId,
  FrontingSessionId,
  KeyGrantId,
  MemberId,
  SystemId,
  SystemStructureEntityId,
} from "./ids.js";
import type { UnixMillis } from "./timestamps.js";

/** A fronting session visible to a friend via bucket access. */
export interface FriendDashboardFrontingSession {
  readonly id: FrontingSessionId;
  readonly memberId: MemberId | null;
  readonly customFrontId: CustomFrontId | null;
  readonly structureEntityId: SystemStructureEntityId | null;
  readonly startTime: UnixMillis;
  readonly encryptedData: string;
}

/** A member visible to a friend via bucket access. */
export interface FriendDashboardMember {
  readonly id: MemberId;
  readonly encryptedData: string;
}

/** A custom front visible to a friend via bucket access. */
export interface FriendDashboardCustomFront {
  readonly id: CustomFrontId;
  readonly encryptedData: string;
}

/** A structure entity visible to a friend via bucket access. */
export interface FriendDashboardStructureEntity {
  readonly id: SystemStructureEntityId;
  readonly encryptedData: string;
}

/** An active (non-revoked) key grant for client-side decryption of bucket data. */
export interface FriendDashboardKeyGrant {
  readonly id: KeyGrantId;
  readonly bucketId: BucketId;
  readonly encryptedKey: string;
  readonly keyVersion: number;
}

/**
 * Friend dashboard response — summary view of a system's data filtered by bucket access.
 *
 * The server returns all bucket-visible data. The client MUST apply
 * FriendVisibilitySettings (showMembers, showGroups, showStructure)
 * after decrypting the connection's encrypted_data.
 */
export interface FriendDashboardResponse {
  readonly systemId: SystemId;
  /** Total non-archived member count (unfiltered — intentional privacy decision). */
  readonly memberCount: number;
  readonly activeFronting: {
    readonly sessions: readonly FriendDashboardFrontingSession[];
    readonly isCofronting: boolean;
  };
  readonly visibleMembers: readonly FriendDashboardMember[];
  readonly visibleCustomFronts: readonly FriendDashboardCustomFront[];
  readonly visibleStructureEntities: readonly FriendDashboardStructureEntity[];
  readonly keyGrants: readonly FriendDashboardKeyGrant[];
}

/**
 * Context produced by assertFriendAccess — contains everything needed
 * to query the target system's data filtered by bucket access.
 */
export interface FriendAccessContext {
  readonly targetAccountId: AccountId;
  readonly targetSystemId: SystemId;
  readonly connectionId: FriendConnectionId;
  readonly assignedBucketIds: readonly BucketId[];
}
