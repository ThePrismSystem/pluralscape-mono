import type {
  BucketId,
  EntityType,
  FriendCodeId,
  FriendConnectionId,
  KeyGrantId,
  SystemId,
} from "./ids.js";
import type { UnixMillis } from "./timestamps.js";
import type { AuditMetadata } from "./utility.js";

/** A privacy bucket — a named container for access-controlled content. */
export interface PrivacyBucket extends AuditMetadata {
  readonly id: BucketId;
  readonly systemId: SystemId;
  readonly name: string;
  readonly description: string | null;
}

/**
 * Tags an entity as belonging to a privacy bucket.
 *
 * Access is fail-closed: if an entity has no bucket tags, or if
 * a friend's assigned buckets do not intersect with the entity's
 * bucket tags for the relevant scope, the entity is invisible.
 */
export interface BucketContentTag {
  readonly entityType: EntityType;
  readonly entityId: string;
  readonly bucketId: BucketId;
}

/** The categories of content that a privacy bucket can control visibility for. */
export type BucketVisibilityScope =
  | "members"
  | "custom-fields"
  | "fronting-status"
  | "custom-fronts"
  | "notes"
  | "chat"
  | "journal-entries"
  | "member-photos"
  | "groups";

/**
 * An immutable grant of a bucket's encryption key to a friend.
 * Created when granting access, optionally revoked. Never updated.
 */
export interface KeyGrant {
  readonly id: KeyGrantId;
  readonly bucketId: BucketId;
  readonly friendUserId: SystemId;
  /** Encrypted symmetric key for the bucket. Serialized to base64 at API transport boundaries. */
  readonly encryptedBucketKey: Uint8Array;
  readonly createdAt: UnixMillis;
  readonly revokedAt: UnixMillis | null;
}

/** Status of a friend connection between two systems. */
export type FriendConnectionStatus = "pending" | "accepted" | "blocked" | "removed";

/** Per-friend visibility toggles — controls what a friend can see beyond bucket access. */
export interface FriendVisibilitySettings {
  readonly showMembers: boolean;
  readonly showGroups: boolean;
  readonly showStructure: boolean;
  readonly allowFrontingNotifications: boolean;
}

/** A mutable friend connection between two systems. */
export interface FriendConnection extends AuditMetadata {
  readonly id: FriendConnectionId;
  readonly systemId: SystemId;
  readonly friendSystemId: SystemId;
  readonly status: FriendConnectionStatus;
  readonly assignedBucketIds: readonly BucketId[];
  readonly visibility: FriendVisibilitySettings;
}

/** An immutable, optionally expiring friend code used to initiate connections. */
export interface FriendCode {
  readonly id: FriendCodeId;
  readonly systemId: SystemId;
  readonly code: string;
  readonly createdAt: UnixMillis;
  readonly expiresAt: UnixMillis | null;
}

/**
 * Parameters for checking whether a friend can access specific content.
 *
 * Access uses intersection logic: a friend can see content only if
 * at least one of their `friendBucketIds` appears in the content's
 * `contentBucketIds` for the given `scope`. If either set is empty,
 * access is denied (fail-closed).
 */
export interface BucketAccessCheck {
  readonly friendBucketIds: readonly BucketId[];
  readonly contentBucketIds: readonly BucketId[];
  readonly scope: BucketVisibilityScope;
}
