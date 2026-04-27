import type { EncryptedWire } from "../encrypted-wire.js";
import type { EncryptedBlob } from "../encryption-primitives.js";
import type {
  AcknowledgementId,
  BoardMessageId,
  BucketId,
  ChannelId,
  CustomFrontId,
  FieldDefinitionId,
  FieldValueId,
  FrontingCommentId,
  FrontingSessionId,
  GroupId,
  InnerWorldEntityId,
  InnerWorldRegionId,
  JournalEntryId,
  MemberId,
  MemberPhotoId,
  MessageId,
  NoteId,
  PollId,
  RelationshipId,
  SystemId,
  SystemStructureEntityId,
  SystemStructureEntityTypeId,
  WikiPageId,
} from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { Serialize } from "../type-assertions.js";
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
 * Keys of `PrivacyBucket` that are encrypted client-side before the server
 * sees them. `name` and `description` are bundled into the T1 `encryptedData`
 * blob. Consumed by:
 * - `__sot-manifest__.ts` (manifest's `encryptedFields` slot)
 * - `PrivacyBucketServerMetadata` (derived via `Omit`)
 */
export type PrivacyBucketEncryptedFields = "name" | "description";

// ── Canonical chain (see ADR-023) ────────────────────────────────────
// PrivacyBucketEncryptedInput → PrivacyBucketServerMetadata
//                            → PrivacyBucketResult → PrivacyBucketWire
// Per-alias JSDoc is intentionally minimal; the alias name plus the
// chain anchor above carries the meaning. Per-alias docs only appear
// when an entity diverges from the standard pattern.

export type PrivacyBucketEncryptedInput = Pick<PrivacyBucket, PrivacyBucketEncryptedFields>;

/**
 * Server-visible PrivacyBucket metadata — raw Drizzle row shape.
 *
 * Derived from `PrivacyBucket` by stripping the encrypted field keys
 * (bundled inside `encryptedData`). Relaxes `archived` from the domain's
 * `false` literal to the raw boolean column and adds the nullable
 * `archivedAt` that the archivable-consistency check requires.
 */
export type PrivacyBucketServerMetadata = Omit<
  PrivacyBucket,
  PrivacyBucketEncryptedFields | "archived"
> & {
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly encryptedData: EncryptedBlob;
};

export type PrivacyBucketResult = EncryptedWire<PrivacyBucketServerMetadata>;

export type PrivacyBucketWire = Serialize<PrivacyBucketResult>;

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
 * A reference to a tagged entity, discriminated by `entityType`.
 *
 * Each variant pairs an entity type with its branded ID, so consumers
 * cannot accidentally tag a member with a group ID. The DB column
 * stays varchar — the brand discriminates only at the app boundary.
 */
export type TaggedEntityRef =
  | { readonly entityType: "member"; readonly entityId: MemberId }
  | { readonly entityType: "group"; readonly entityId: GroupId }
  | { readonly entityType: "channel"; readonly entityId: ChannelId }
  | { readonly entityType: "message"; readonly entityId: MessageId }
  | { readonly entityType: "note"; readonly entityId: NoteId }
  | { readonly entityType: "poll"; readonly entityId: PollId }
  | { readonly entityType: "relationship"; readonly entityId: RelationshipId }
  | { readonly entityType: "structure-entity-type"; readonly entityId: SystemStructureEntityTypeId }
  | { readonly entityType: "structure-entity"; readonly entityId: SystemStructureEntityId }
  | { readonly entityType: "journal-entry"; readonly entityId: JournalEntryId }
  | { readonly entityType: "wiki-page"; readonly entityId: WikiPageId }
  | { readonly entityType: "custom-front"; readonly entityId: CustomFrontId }
  | { readonly entityType: "fronting-session"; readonly entityId: FrontingSessionId }
  | { readonly entityType: "board-message"; readonly entityId: BoardMessageId }
  | { readonly entityType: "acknowledgement"; readonly entityId: AcknowledgementId }
  | { readonly entityType: "innerworld-entity"; readonly entityId: InnerWorldEntityId }
  | { readonly entityType: "innerworld-region"; readonly entityId: InnerWorldRegionId }
  | { readonly entityType: "field-definition"; readonly entityId: FieldDefinitionId }
  | { readonly entityType: "field-value"; readonly entityId: FieldValueId }
  | { readonly entityType: "member-photo"; readonly entityId: MemberPhotoId }
  | { readonly entityType: "fronting-comment"; readonly entityId: FrontingCommentId };

/**
 * Tags an entity as belonging to a privacy bucket.
 *
 * Access is fail-closed: if an entity has no bucket tags, or if
 * a friend's assigned buckets do not intersect with the entity's
 * bucket tags for the relevant scope, the entity is invisible.
 *
 * The (entityType, entityId) pair is a discriminated union — each
 * entity type narrows the entityId to its branded ID type.
 */
export type BucketContentTag = TaggedEntityRef & { readonly bucketId: BucketId };

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
