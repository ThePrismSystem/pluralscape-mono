import type { FriendDashboardKeyGrant } from "./friend-dashboard.js";
import type { SystemId } from "./ids.js";
import type { PaginatedResult } from "./pagination.js";
import type { BucketContentEntityType } from "./privacy.js";
import type { UnixMillis } from "./timestamps.js";

/**
 * Entity types available for friend-side data export.
 *
 * Currently identical to BucketContentEntityType — every bucket-taggable
 * entity is exportable. Defined as a separate type so the export surface
 * can diverge from bucket tagging if needed.
 */
export type FriendExportEntityType = BucketContentEntityType;

/** Runtime array of all FriendExportEntityType values. */
export const FRIEND_EXPORT_ENTITY_TYPES = [
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
] as const satisfies readonly FriendExportEntityType[];

/** Type guard for FriendExportEntityType — validates unknown strings at trust boundaries. */
export function isFriendExportEntityType(value: string): value is FriendExportEntityType {
  return (FRIEND_EXPORT_ENTITY_TYPES as readonly string[]).includes(value);
}

/** A single entity in a friend data export page. */
export interface FriendExportEntity {
  readonly id: string;
  readonly entityType: FriendExportEntityType;
  readonly encryptedData: string;
  readonly updatedAt: UnixMillis;
}

/** Paginated response for a friend data export page, with ETag for conditional requests. */
export interface FriendExportPageResponse extends PaginatedResult<FriendExportEntity> {
  readonly etag: string;
}

/** Per-entity-type entry in the export manifest. */
export interface FriendExportManifestEntry {
  readonly entityType: FriendExportEntityType;
  readonly count: number;
  readonly lastUpdatedAt: UnixMillis | null;
}

/** Response for the export manifest endpoint. */
export interface FriendExportManifestResponse {
  readonly systemId: SystemId;
  readonly entries: readonly FriendExportManifestEntry[];
  readonly keyGrants: readonly FriendDashboardKeyGrant[];
  readonly etag: string;
}
