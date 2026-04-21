/**
 * Bucket data export service.
 *
 * Provides paginated export of all entities tagged with a specific privacy
 * bucket. Unlike friend-export (which post-filters across multiple buckets),
 * bucket export uses a direct JOIN on bucket_content_tags — entities are
 * either tagged or not, so no overfetch loop is needed.
 */
import { brandId } from "@pluralscape/types";

import { batchedManifestQueries } from "../lib/batch.js";
import { encryptedBlobToBase64 } from "../lib/encrypted-blob.js";
import { computeDataEtag, computeManifestEtag } from "../lib/etag.js";
import { fromCompositeCursor, toCompositeCursor } from "../lib/pagination.js";
import { withTenantRead } from "../lib/rls-context.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
import { tenantCtx } from "../lib/tenant-context.js";

import { assertBucketExists } from "./bucket/internal.js";
import { BUCKET_EXPORT_TABLE_REGISTRY } from "./bucket-export.constants.js";

import type { BucketExportRow } from "./bucket-export.constants.js";
import type { AuthContext } from "../lib/auth-context.js";
import type {
  BucketContentEntityType,
  BucketExportEntity,
  BucketExportManifestEntry,
  BucketExportManifestResponse,
  BucketExportPageResponse,
  BucketId,
  ExportEntityId,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Manifest ───────────────────────────────────────────────────────

/**
 * Get the export manifest for a bucket — per-entity-type counts and freshness timestamps.
 *
 * The client calls this to decide which entity types need refreshing
 * before starting paginated downloads.
 */
export async function getBucketExportManifest(
  db: PostgresJsDatabase,
  systemId: SystemId,
  bucketId: BucketId,
  auth: AuthContext,
): Promise<BucketExportManifestResponse> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    await assertBucketExists(tx, systemId, bucketId);

    const entries = await buildManifestEntries(tx, systemId, bucketId);

    const etag = computeManifestEtag(entries);

    return {
      systemId,
      bucketId,
      entries,
      etag,
    };
  });
}

/** Build manifest entries for all entity types in batched parallel groups. */
async function buildManifestEntries(
  tx: PostgresJsDatabase,
  systemId: SystemId,
  bucketId: BucketId,
): Promise<readonly BucketExportManifestEntry[]> {
  const entityTypes = Object.keys(BUCKET_EXPORT_TABLE_REGISTRY) as BucketContentEntityType[];

  return batchedManifestQueries(
    entityTypes.map((entityType) => async () => {
      const { count, maxUpdatedAt } = await BUCKET_EXPORT_TABLE_REGISTRY[
        entityType
      ].queryManifestCount(tx, systemId, bucketId);
      return { entityType, count, lastUpdatedAt: maxUpdatedAt };
    }),
  );
}

// ── Paginated export ───────────────────────────────────────────────

/**
 * Get a paginated page of encrypted entities tagged with a specific bucket.
 *
 * Entities are ordered by updatedAt ASC, id ASC for deterministic cursor-based
 * pagination and natural incremental sync ordering.
 *
 * Unlike friend-export, no overfetch loop is needed — the INNER JOIN on
 * bucket_content_tags directly returns only tagged entities.
 */
export async function getBucketExportPage(
  db: PostgresJsDatabase,
  systemId: SystemId,
  bucketId: BucketId,
  auth: AuthContext,
  entityType: BucketContentEntityType,
  limit: number,
  cursor?: string,
): Promise<BucketExportPageResponse> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    await assertBucketExists(tx, systemId, bucketId);

    const queryFns = BUCKET_EXPORT_TABLE_REGISTRY[entityType];
    const decodedCursor = cursor ? fromCompositeCursor(cursor, "bucket-export") : undefined;

    const rows = await queryFns.queryBucketExportRows(tx, systemId, bucketId, limit, decodedCursor);

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;

    const items: BucketExportEntity[] = pageRows.map((r: BucketExportRow) => ({
      id: brandId<ExportEntityId>(r.id),
      entityType,
      encryptedData: encryptedBlobToBase64(r.encryptedData),
      updatedAt: r.updatedAt,
    }));

    const lastItem = items[items.length - 1];
    const nextCursor =
      hasMore && lastItem ? toCompositeCursor(lastItem.updatedAt, lastItem.id) : null;

    // ETag: items are ordered ASC, so the last item has the max updatedAt
    const maxUpdatedAt: UnixMillis | null = lastItem?.updatedAt ?? null;

    return {
      data: items,
      nextCursor,
      hasMore,
      totalCount: null,
      etag: computeDataEtag(maxUpdatedAt, items.length),
    };
  });
}
