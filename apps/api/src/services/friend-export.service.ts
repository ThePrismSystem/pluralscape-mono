/**
 * Friend data export service.
 *
 * Provides paginated export of all bucket-visible encrypted entities for
 * client-side search indexing. The server returns encrypted blobs — all
 * search happens client-side (zero-knowledge).
 */
import { batchedManifestQueries } from "../lib/batch.js";
import { filterVisibleEntities, loadBucketTags } from "../lib/bucket-access.js";
import { encryptedBlobToBase64 } from "../lib/encrypted-blob.js";
import { computeDataEtag, computeManifestEtag } from "../lib/etag.js";
import { assertFriendAccess } from "../lib/friend-access.js";
import { fromCompositeCursor, toCompositeCursor } from "../lib/pagination.js";
import { withCrossAccountRead } from "../lib/rls-context.js";

import { queryActiveKeyGrants } from "./friend-dashboard.service.js";
import { EXPORT_TABLE_REGISTRY } from "./friend-export.constants.js";

import type { ExportRow } from "./friend-export.constants.js";
import type { AuthContext } from "../lib/auth-context.js";
import type { DecodedCompositeCursor } from "../lib/pagination.js";
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

/** Over-fetch multiplier per batch to compensate for post-query bucket filtering. */
const EXPORT_OVERFETCH_MULTIPLIER = 3;

/** Maximum fetch iterations before returning a partial page. */
const EXPORT_MAX_FETCH_ITERATIONS = 5;

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

    const etag = computeManifestEtag(entries);

    return {
      systemId: access.targetSystemId,
      entries,
      keyGrants: activeKeyGrants,
      etag,
    };
  });
}

/** Build manifest entries for all entity types in batched parallel groups. */
async function buildManifestEntries(
  tx: PostgresJsDatabase,
  systemId: SystemId,
  friendBucketIds: readonly BucketId[],
): Promise<readonly FriendExportManifestEntry[]> {
  const entityTypes = Object.keys(EXPORT_TABLE_REGISTRY) as FriendExportEntityType[];

  return batchedManifestQueries(
    entityTypes.map(
      (entityType) => () => buildManifestEntry(tx, systemId, friendBucketIds, entityType),
    ),
  );
}

/** Build a single manifest entry using an efficient JOIN-based count query. */
async function buildManifestEntry(
  tx: PostgresJsDatabase,
  systemId: SystemId,
  friendBucketIds: readonly BucketId[],
  entityType: FriendExportEntityType,
): Promise<FriendExportManifestEntry> {
  const queryFns = EXPORT_TABLE_REGISTRY[entityType];
  const { count, maxUpdatedAt } = await queryFns.queryManifestCount(tx, systemId, friendBucketIds);
  return { entityType, count, lastUpdatedAt: maxUpdatedAt };
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

/**
 * Query, filter, and paginate entities for a single entity type.
 *
 * Uses a batched fetch loop to compensate for post-query bucket filtering:
 * fetches up to EXPORT_OVERFETCH_MULTIPLIER * limit rows per iteration,
 * accumulating visible items until the page is full or data is exhausted.
 * This prevents empty-page loops when most entities are invisible to the friend.
 */
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
  const batchSize = limit * EXPORT_OVERFETCH_MULTIPLIER;

  const visible: FriendExportEntity[] = [];
  let currentCursor: DecodedCompositeCursor | undefined = cursor
    ? fromCompositeCursor(cursor, "export")
    : undefined;
  let dbExhausted = false;
  let lastRawRow: ExportRow | undefined;

  for (let iter = 0; iter < EXPORT_MAX_FETCH_ITERATIONS && visible.length < limit; iter++) {
    const rows = await queryFns.queryExportRows(tx, systemId, batchSize, currentCursor);

    if (rows.length === 0) {
      dbExhausted = true;
      break;
    }
    if (rows.length < batchSize) {
      dbExhausted = true;
    }

    // Filter by bucket visibility
    const entityIds = rows.map((r) => r.id);
    const bucketMap = await loadBucketTags(tx, systemId, entityType, entityIds);
    const visibleBatch = filterVisibleEntities(rows, friendBucketIds, bucketMap, (r) => r.id);

    for (const r of visibleBatch) {
      visible.push({
        id: r.id,
        entityType,
        encryptedData: encryptedBlobToBase64(r.encryptedData),
        updatedAt: r.updatedAt,
      });
    }

    // Advance cursor past last raw row consumed (rows.length > 0 guaranteed by the early break above)
    const lastRow = rows[rows.length - 1];
    if (lastRow) {
      lastRawRow = lastRow;
      currentCursor = { sortValue: lastRawRow.updatedAt as number, id: lastRawRow.id };
    }

    if (dbExhausted) break;
  }

  // hasMore: true if we found excess visible items OR the DB still has rows
  const hasMore = visible.length > limit || !dbExhausted;
  const items = visible.slice(0, limit);

  // Cursor points to the last visible item returned (not the last raw row).
  // This ensures the next page starts right after the last item the client received,
  // re-fetching any invisible rows between visible items as expected.
  const lastItem = items[items.length - 1];
  const nextCursor =
    hasMore && lastItem ? toCompositeCursor(lastItem.updatedAt as number, lastItem.id) : null;

  // ETag from visible items on this page
  let maxUpdatedAt: UnixMillis | null = null;
  for (const item of items) {
    if (maxUpdatedAt === null || item.updatedAt > maxUpdatedAt) {
      maxUpdatedAt = item.updatedAt;
    }
  }

  return {
    items,
    nextCursor,
    hasMore,
    totalCount: null,
    etag: computeDataEtag(maxUpdatedAt, items.length),
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
