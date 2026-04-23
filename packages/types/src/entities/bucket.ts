import type { BucketId, SystemId } from "../ids.js";
import type { Archived, AuditMetadata } from "../utility.js";

/** A privacy bucket — a named container for access-controlled content. */
export interface PrivacyBucket extends AuditMetadata {
  readonly id: BucketId;
  readonly systemId: SystemId;
  readonly name: string;
  readonly description: string | null;
  readonly archived: false;
}

/** An archived privacy bucket. */
export type ArchivedPrivacyBucket = Archived<PrivacyBucket>;

/**
 * Entity types that can be tagged in privacy buckets.
 *
 * This is user-owned content subject to bucket-level privacy controls.
 * Infrastructure types (accounts, sessions, jobs, sync documents, etc.)
 * are excluded because they are not shareable content.
 */
export type BucketContentEntityType =
  | "member"
  | "group"
  | "channel"
  | "message"
  | "note"
  | "poll"
  | "relationship"
  | "structure-entity-type"
  | "structure-entity"
  | "journal-entry"
  | "wiki-page"
  | "custom-front"
  | "fronting-session"
  | "board-message"
  | "acknowledgement"
  | "innerworld-entity"
  | "innerworld-region"
  | "field-definition"
  | "field-value"
  | "member-photo"
  | "fronting-comment";

/**
 * Runtime array of all BucketContentEntityType values.
 * Used for Zod enum validation and DB CHECK constraints.
 */
export const BUCKET_CONTENT_ENTITY_TYPES = [
  "member",
  "group",
  "channel",
  "message",
  "note",
  "poll",
  "relationship",
  "structure-entity-type",
  "structure-entity",
  "journal-entry",
  "wiki-page",
  "custom-front",
  "fronting-session",
  "board-message",
  "acknowledgement",
  "innerworld-entity",
  "innerworld-region",
  "field-definition",
  "field-value",
  "member-photo",
  "fronting-comment",
] as const satisfies readonly BucketContentEntityType[];

/** Type guard for BucketContentEntityType — validates unknown strings at trust boundaries. */
export function isBucketContentEntityType(value: string): value is BucketContentEntityType {
  return (BUCKET_CONTENT_ENTITY_TYPES as readonly string[]).includes(value);
}

/**
 * Tags an entity as belonging to a privacy bucket.
 *
 * Access is fail-closed: if an entity has no bucket tags, or if
 * a friend's assigned buckets do not intersect with the entity's
 * bucket tags for the relevant scope, the entity is invisible.
 */
export interface BucketContentTag {
  readonly entityType: BucketContentEntityType;
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
}
