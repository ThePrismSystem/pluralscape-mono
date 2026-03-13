import { sql } from "drizzle-orm";

import type { CleanupResult } from "./sync-queue-cleanup.js";
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
 * PG variant — uses NOT IN subquery for orphan detection.
 * Returns count via RETURNING + array length.
 */
export async function pgCleanupOrphanedTags<
  TSchema extends Record<string, unknown> = Record<string, never>,
>(
  db: PostgresJsDatabase<TSchema> | PgliteDatabase<TSchema>,
  entityType: BucketContentEntityType,
): Promise<CleanupResult> {
  const sourceTable = ENTITY_TABLE_MAP[entityType];
  const result = await db.execute(
    sql`DELETE FROM bucket_content_tags
        WHERE entity_type = ${entityType}
        AND entity_id NOT IN (
          SELECT id FROM ${sql.raw(sourceTable)}
        )
        RETURNING entity_id`,
  );

  // PGlite returns { rows: [...] }, postgres.js returns RowList (array-like)
  const count = Array.isArray(result) ? result.length : result.rows.length;
  return { deletedCount: count };
}

/**
 * Delete orphaned bucketContentTags for a specific entity type.
 * SQLite variant.
 */
export function sqliteCleanupOrphanedTags<
  TSchema extends Record<string, unknown> = Record<string, never>,
>(db: BetterSQLite3Database<TSchema>, entityType: BucketContentEntityType): CleanupResult {
  const sourceTable = ENTITY_TABLE_MAP[entityType];
  const result = db.run(
    sql`DELETE FROM bucket_content_tags
        WHERE entity_type = ${entityType}
        AND entity_id NOT IN (
          SELECT id FROM ${sql.raw(sourceTable)}
        )`,
  );

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
  for (const entityType of Object.keys(ENTITY_TABLE_MAP) as BucketContentEntityType[]) {
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
  for (const entityType of Object.keys(ENTITY_TABLE_MAP) as BucketContentEntityType[]) {
    const result = sqliteCleanupOrphanedTags(db, entityType);
    total += result.deletedCount;
  }
  return { deletedCount: total };
}
