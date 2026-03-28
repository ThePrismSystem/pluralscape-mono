/**
 * Friend data export service.
 *
 * Provides paginated export of all bucket-visible encrypted entities for
 * client-side search indexing. The server returns encrypted blobs — all
 * search happens client-side (zero-knowledge).
 */
import { filterVisibleEntities, loadBucketTags } from "../lib/bucket-access.js";
import { encryptedBlobToBase64 } from "../lib/encrypted-blob.js";
import { computeDataEtag } from "../lib/etag.js";
import { assertFriendAccess } from "../lib/friend-access.js";
import { fromCompositeCursor, toCompositeCursor } from "../lib/pagination.js";
import { withCrossAccountRead } from "../lib/rls-context.js";

import { queryActiveKeyGrants } from "./friend-dashboard.service.js";
import { EXPORT_TABLE_REGISTRY } from "./friend-export.constants.js";

import type { AuthContext } from "../lib/auth-context.js";
import type {
  BucketId,
  FriendConnectionId,
  FriendExportEntity,
  FriendExportEntityType,
  FriendExportManifestEntry,
  FriendExportManifestResponse,
  FriendExportPageResponse,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Manifest ───────────────────────────────────────────────────────

/**
 * Get the export manifest — per-entity-type counts and freshness timestamps.
 *
 * The client calls this to decide which entity types need refreshing
 * before starting paginated downloads.
 */
export async function getFriendExportManifest(
  db: PostgresJsDatabase,
  connectionId: FriendConnectionId,
  auth: AuthContext,
): Promise<FriendExportManifestResponse> {
  return withCrossAccountRead(db, async (tx) => {
    const access = await assertFriendAccess(tx, connectionId, auth);

    const [entries, activeKeyGrants] = await Promise.all([
      buildManifestEntries(tx, access.targetSystemId, access.assignedBucketIds),
      queryActiveKeyGrants(tx, access.targetSystemId, auth.accountId),
    ]);

    // Compute overall ETag from all per-type max timestamps
    const globalMaxUpdatedAt = entries.reduce<UnixMillis | null>((max, e) => {
      if (e.lastUpdatedAt === null) return max;
      if (max === null) return e.lastUpdatedAt;
      return e.lastUpdatedAt > max ? e.lastUpdatedAt : max;
    }, null);
    const totalCount = entries.reduce((sum, e) => sum + e.count, 0);
    const etag = computeDataEtag(globalMaxUpdatedAt, totalCount);

    return {
      systemId: access.targetSystemId,
      entries,
      keyGrants: activeKeyGrants,
      etag,
    };
  });
}

/** Build manifest entries for all entity types in parallel. */
async function buildManifestEntries(
  tx: PostgresJsDatabase,
  systemId: SystemId,
  friendBucketIds: readonly BucketId[],
): Promise<readonly FriendExportManifestEntry[]> {
  const entityTypes = Object.keys(EXPORT_TABLE_REGISTRY) as FriendExportEntityType[];

  return Promise.all(
    entityTypes.map((entityType) => buildManifestEntry(tx, systemId, friendBucketIds, entityType)),
  );
}

/** Build a single manifest entry for one entity type. */
async function buildManifestEntry(
  tx: PostgresJsDatabase,
  systemId: SystemId,
  friendBucketIds: readonly BucketId[],
  entityType: FriendExportEntityType,
): Promise<FriendExportManifestEntry> {
  if (friendBucketIds.length === 0) {
    return { entityType, count: 0, lastUpdatedAt: null };
  }

  const queryFns = EXPORT_TABLE_REGISTRY[entityType];
  const rows = await queryFns.queryManifestRows(tx, systemId);

  const entityIds = rows.map((r) => r.id);
  const bucketMap = await loadBucketTags(tx, systemId, entityType, entityIds);
  const visible = filterVisibleEntities(rows, friendBucketIds, bucketMap, (r) => r.id);

  let lastUpdatedAt: UnixMillis | null = null;
  for (const r of visible) {
    const ts = r.updatedAt as UnixMillis;
    if (lastUpdatedAt === null || ts > lastUpdatedAt) {
      lastUpdatedAt = ts;
    }
  }

  return { entityType, count: visible.length, lastUpdatedAt };
}

// ── Paginated export ───────────────────────────────────────────────

/**
 * Get a paginated page of bucket-visible encrypted entities for one entity type.
 *
 * Entities are ordered by updatedAt ASC, id ASC for deterministic cursor-based
 * pagination and natural incremental sync ordering.
 */
export async function getFriendExportPage(
  db: PostgresJsDatabase,
  connectionId: FriendConnectionId,
  auth: AuthContext,
  entityType: FriendExportEntityType,
  limit: number,
  cursor?: string,
): Promise<FriendExportPageResponse> {
  return withCrossAccountRead(db, async (tx) => {
    const access = await assertFriendAccess(tx, connectionId, auth);

    return queryExportPage(
      tx,
      access.targetSystemId,
      access.assignedBucketIds,
      entityType,
      limit,
      cursor,
    );
  });
}

/** Query, filter, and paginate entities for a single entity type. */
async function queryExportPage(
  tx: PostgresJsDatabase,
  systemId: SystemId,
  friendBucketIds: readonly BucketId[],
  entityType: FriendExportEntityType,
  limit: number,
  cursor?: string,
): Promise<FriendExportPageResponse> {
  if (friendBucketIds.length === 0) {
    return emptyPage();
  }

  const queryFns = EXPORT_TABLE_REGISTRY[entityType];

  // Decode cursor if provided
  const cursorValues = cursor ? fromCompositeCursor(cursor, "export") : undefined;

  // Fetch limit+1 to detect hasMore
  const rows = await queryFns.queryExportRows(tx, systemId, limit + 1, cursorValues);

  // Filter by bucket visibility
  const entityIds = rows.map((r) => r.id);
  const bucketMap = await loadBucketTags(tx, systemId, entityType, entityIds);
  const visibleRows = filterVisibleEntities(rows, friendBucketIds, bucketMap, (r) => r.id);

  // Build paginated result
  const hasMore = rows.length > limit;
  const pageRows = visibleRows.slice(0, limit);

  const items: FriendExportEntity[] = pageRows.map((r) => ({
    id: r.id,
    entityType,
    encryptedData: encryptedBlobToBase64(r.encryptedData),
    updatedAt: r.updatedAt as UnixMillis,
  }));

  // Cursor points to the last RAW row fetched (not filtered) so the next page
  // starts after it, ensuring we don't skip or re-visit rows.
  const lastRaw = rows.length > limit ? rows[limit - 1] : rows[rows.length - 1];
  const nextCursor = hasMore && lastRaw ? toCompositeCursor(lastRaw.updatedAt, lastRaw.id) : null;

  // ETag from visible items on this page
  let maxUpdatedAt: UnixMillis | null = null;
  for (const item of items) {
    if (maxUpdatedAt === null || item.updatedAt > maxUpdatedAt) {
      maxUpdatedAt = item.updatedAt;
    }
  }
  const etag = computeDataEtag(maxUpdatedAt, items.length);

  return {
    items,
    nextCursor,
    hasMore,
    totalCount: null,
    etag,
  };
}

function emptyPage(): FriendExportPageResponse {
  return {
    items: [],
    nextCursor: null,
    hasMore: false,
    totalCount: null,
    etag: computeDataEtag(null, 0),
  };
}
