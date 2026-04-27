import type { EncryptedWire } from "../encrypted-wire.js";
import type { EncryptedBlob } from "../encryption-primitives.js";
import type { BucketId, EntityTypeIdMap, SystemId } from "../ids.js";
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
 *
 * Generated as a mapped type over {@link BucketContentEntityType} indexing
 * into {@link EntityTypeIdMap}. The {@link _AssertBucketContentEntityTypesMapped}
 * compile-time assertion below guarantees every variant of
 * `BucketContentEntityType` has a corresponding entry in `EntityTypeIdMap`,
 * so adding a new tag-eligible entity is a one-line change to the
 * `BucketContentEntityType` union and remains exhaustive everywhere.
 */
export type TaggedEntityRef = {
  [K in BucketContentEntityType]: {
    readonly entityType: K;
    readonly entityId: EntityTypeIdMap[K];
  };
}[BucketContentEntityType];

// Compile-time check: every BucketContentEntityType variant must appear as a
// key in EntityTypeIdMap. Adding a new tag-eligible entity to the union
// without a matching EntityTypeIdMap entry is a type error here.
type _AssertBucketContentEntityTypesMapped = {
  [K in BucketContentEntityType]: K extends keyof EntityTypeIdMap
    ? true
    : `Missing EntityTypeIdMap entry for "${K}"`;
}[BucketContentEntityType];
const _ASSERT_BUCKET_CONTENT_ENTITY_TYPES_MAPPED: _AssertBucketContentEntityTypesMapped = true;
void _ASSERT_BUCKET_CONTENT_ENTITY_TYPES_MAPPED;

/**
 * Tags an entity as belonging to a privacy bucket.
 *
 * Access is fail-closed: if an entity has no bucket tags, or if
 * a friend's assigned buckets do not intersect with the entity's
 * bucket tags for the relevant scope, the entity is invisible.
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
