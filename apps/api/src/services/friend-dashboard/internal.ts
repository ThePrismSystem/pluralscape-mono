import { bucketContentTags } from "@pluralscape/db/pg";
import { and, eq, inArray } from "drizzle-orm";

import { loadBucketTags } from "../../lib/bucket-access.js";
import { encryptedBlobToBase64 } from "../../lib/encrypted-blob.js";

import type {
  BucketContentEntityType,
  BucketId,
  EncryptedBlob,
  SystemId,
} from "@pluralscape/types";
import type { SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Internal types ─────────────────────────────────────────────

export interface DashboardEntityRow {
  readonly id: string;
  readonly encryptedData: EncryptedBlob;
}

/** Decomposed table reference for the generic queryVisibleEntities helper. */
export interface DashboardTableRef {
  readonly table: PgTable;
  readonly id: PgColumn;
  readonly systemId: PgColumn;
  readonly encryptedData: PgColumn;
  readonly archived: PgColumn;
}

/** Per-request cache key for loadBucketTags results. */
type BucketTagCacheKey = `${string}:${string}`;

/**
 * Request-scoped cache for loadBucketTags results.
 *
 * Created fresh per `getFriendDashboard` call to avoid cross-tenant
 * cache poisoning. Keyed by `systemId:entityType`.
 */
export type BucketTagCache = Map<BucketTagCacheKey, ReadonlyMap<string, readonly BucketId[]>>;

function bucketTagCacheKey(
  systemId: SystemId,
  entityType: BucketContentEntityType,
): BucketTagCacheKey {
  return `${systemId}:${entityType}`;
}

/** Load bucket tags with per-request caching per (systemId, entityType). */
export async function cachedLoadBucketTags(
  tx: PostgresJsDatabase,
  systemId: SystemId,
  entityType: BucketContentEntityType,
  entityIds: readonly string[],
  cache: BucketTagCache,
): Promise<ReadonlyMap<string, readonly BucketId[]>> {
  if (entityIds.length === 0) {
    return new Map();
  }

  const key = bucketTagCacheKey(systemId, entityType);
  const cached = cache.get(key);

  if (cached) {
    const allPresent = entityIds.every((id) => cached.has(id));
    if (allPresent) {
      return cached;
    }
  }

  const result = await loadBucketTags(tx, systemId, entityType, entityIds);

  // Merge with existing cached entries for this key
  const merged = cached ? new Map(cached) : new Map<string, readonly BucketId[]>();
  for (const [entityId, bucketIds] of result) {
    merged.set(entityId, bucketIds);
  }

  cache.set(key, merged);

  return result;
}

// ── Generic visible entities helper (M11 + M3) ────────────────

/**
 * Query non-archived entities visible to a friend via bucket intersection,
 * using an INNER JOIN on bucket_content_tags for SQL-level filtering.
 *
 * This replaces the previous pattern of fetching all entities, loading
 * bucket tags, and filtering in memory.
 */
export async function queryVisibleEntities<TId extends string>(
  tx: PostgresJsDatabase,
  ref: DashboardTableRef,
  entityType: BucketContentEntityType,
  systemId: SystemId,
  friendBucketIds: readonly BucketId[],
  mapId: (id: string) => TId,
  limit: number,
): Promise<readonly { readonly id: TId; readonly encryptedData: string }[]> {
  if (friendBucketIds.length === 0) {
    return [];
  }

  const conds: SQL[] = [
    eq(ref.systemId, systemId),
    eq(ref.archived, false),
    inArray(bucketContentTags.bucketId, friendBucketIds),
  ];

  const rows = await tx
    .selectDistinctOn([ref.id], {
      id: ref.id,
      encryptedData: ref.encryptedData,
    })
    .from(ref.table)
    .innerJoin(
      bucketContentTags,
      and(
        eq(bucketContentTags.entityId, ref.id),
        eq(bucketContentTags.systemId, ref.systemId),
        eq(bucketContentTags.entityType, entityType),
      ),
    )
    .where(and(...conds))
    .limit(limit);

  return (rows as DashboardEntityRow[]).map((r) => ({
    id: mapId(r.id),
    encryptedData: encryptedBlobToBase64(r.encryptedData),
  }));
}
