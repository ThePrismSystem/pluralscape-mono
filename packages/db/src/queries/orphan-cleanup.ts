import { and, eq, sql } from "drizzle-orm";

import { BUCKET_CONTENT_ENTITY_TYPES } from "../helpers/enums.js";
import { bucketContentTags as pgBucketContentTags } from "../schema/pg/privacy.js";
import { bucketContentTags as sqliteBucketContentTags } from "../schema/sqlite/privacy.js";

import type { CleanupResult } from "./types.js";
import type { BucketContentEntityType } from "@pluralscape/types";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/**
 * Maps entity types to their source table names (as used in SQL).
 * This is the authoritative mapping for orphan detection.
 */
const ENTITY_TABLE_MAP: Readonly<Record<BucketContentEntityType, string>> = {
  member: "members",
  group: "groups",
  channel: "channels",
  message: "messages",
  note: "notes",
  poll: "polls",
  relationship: "relationships",
  subsystem: "subsystems",
  "side-system": "side_systems",
  layer: "layers",
  "journal-entry": "journal_entries",
  "wiki-page": "wiki_pages",
  "custom-front": "custom_fronts",
  "fronting-session": "fronting_sessions",
  "board-message": "board_messages",
  acknowledgement: "acknowledgements",
  "innerworld-entity": "innerworld_entities",
  "innerworld-region": "innerworld_regions",
  "field-definition": "field_definitions",
  "field-value": "field_values",
  "member-photo": "member_photos",
  "fronting-comment": "fronting_comments",
};

/**
 * Delete orphaned bucketContentTags for a specific entity type.
 * An orphaned tag is one whose source entity row no longer exists.
 *
 * PG variant — uses a CTE to count deleted rows without materialising
 * them into JS memory. `.returning()` would load every deleted row as
 * a JS object, causing OOM when large numbers of tags are purged.
 */
export async function pgCleanupOrphanedTags<
  TSchema extends Record<string, unknown> = Record<string, never>,
>(
  db: PostgresJsDatabase<TSchema> | PgliteDatabase<TSchema>,
  entityType: BucketContentEntityType,
): Promise<CleanupResult> {
  const sourceTable = ENTITY_TABLE_MAP[entityType];
  const result = await db.execute<{ deleted_count: string }>(
    sql`WITH deleted AS (
      DELETE FROM ${pgBucketContentTags}
      WHERE ${pgBucketContentTags.entityType} = ${entityType}
        AND NOT EXISTS (
          SELECT 1 FROM ${sql.raw(sourceTable)}
          WHERE id = ${pgBucketContentTags.entityId}
        )
      RETURNING 1
    )
    SELECT count(*) AS deleted_count FROM deleted`,
  );

  // postgres-js returns RowList (an array); pglite returns Results ({ rows: [...] })
  const row = Array.isArray(result) ? result[0] : result.rows[0];
  return { deletedCount: Number(row?.deleted_count ?? 0) };
}

/**
 * Delete orphaned bucketContentTags for a specific entity type.
 * SQLite variant — uses NOT EXISTS subquery for orphan detection.
 */
export function sqliteCleanupOrphanedTags<
  TSchema extends Record<string, unknown> = Record<string, never>,
>(db: BetterSQLite3Database<TSchema>, entityType: BucketContentEntityType): CleanupResult {
  const sourceTable = ENTITY_TABLE_MAP[entityType];
  const result = db
    .delete(sqliteBucketContentTags)
    .where(
      and(
        eq(sqliteBucketContentTags.entityType, entityType),
        sql`NOT EXISTS (SELECT 1 FROM ${sql.raw(sourceTable)} WHERE id = ${sqliteBucketContentTags.entityId})`,
      ),
    )
    .run();

  return { deletedCount: result.changes };
}

/**
 * Run orphan cleanup for all entity types.
 * Processes one type at a time to avoid long-running queries.
 */
export async function pgCleanupAllOrphanedTags<
  TSchema extends Record<string, unknown> = Record<string, never>,
>(db: PostgresJsDatabase<TSchema> | PgliteDatabase<TSchema>): Promise<CleanupResult> {
  let total = 0;
  for (const entityType of BUCKET_CONTENT_ENTITY_TYPES) {
    const result = await pgCleanupOrphanedTags(db, entityType);
    total += result.deletedCount;
  }
  return { deletedCount: total };
}

/**
 * Run orphan cleanup for all entity types.
 * SQLite variant — synchronous.
 */
export function sqliteCleanupAllOrphanedTags<
  TSchema extends Record<string, unknown> = Record<string, never>,
>(db: BetterSQLite3Database<TSchema>): CleanupResult {
  let total = 0;
  for (const entityType of BUCKET_CONTENT_ENTITY_TYPES) {
    const result = sqliteCleanupOrphanedTags(db, entityType);
    total += result.deletedCount;
  }
  return { deletedCount: total };
}
