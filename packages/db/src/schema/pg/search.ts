import { sql } from "drizzle-orm";

import type { SearchableEntityType } from "@pluralscape/types";
import type { SQL } from "drizzle-orm";

const DEFAULT_SEARCH_LIMIT = 50;

/**
 * DDL for PG full-text search index table.
 *
 * Multi-tenant (system_id column) unlike single-tenant SQLite FTS5.
 * Uses a GENERATED tsvector column for automatic index maintenance.
 *
 * Self-hosted only: the search_index stores plaintext. Hosted/cloud deployments
 * must not populate this table — search remains client-side via SQLite FTS5.
 * See ADR 018 for the trust boundary.
 */
export const SEARCH_INDEX_DDL = `
  CREATE TABLE IF NOT EXISTS search_index (
    system_id VARCHAR(255) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(255) NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    search_vector tsvector GENERATED ALWAYS AS (
      setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(content, '')), 'B')
    ) STORED,
    PRIMARY KEY (system_id, entity_type, entity_id)
  )
`;

/** GIN index on the tsvector column for fast full-text queries. */
export const SEARCH_INDEX_INDEXES_DDL = `
  CREATE INDEX IF NOT EXISTS search_index_vector_idx ON search_index USING GIN (search_vector);
  CREATE INDEX IF NOT EXISTS search_index_system_entity_type_idx ON search_index (system_id, entity_type)
`;

/**
 * Fallback DDL for PGlite tests (no GENERATED ALWAYS AS support for tsvector).
 * search_vector is a plain nullable column; the search query falls back to
 * computing tsvector inline via COALESCE when it is NULL.
 */
export const SEARCH_INDEX_TEST_DDL = `
  CREATE TABLE IF NOT EXISTS search_index (
    system_id VARCHAR(255) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(255) NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    search_vector tsvector,
    PRIMARY KEY (system_id, entity_type, entity_id)
  )
`;

export const SEARCH_INDEX_TEST_INDEXES_DDL = `
  CREATE INDEX IF NOT EXISTS search_index_system_entity_type_idx ON search_index (system_id, entity_type)
`;

/** Shape of a search index entry (input). */
export interface PgSearchIndexEntry {
  readonly systemId: string;
  readonly entityType: SearchableEntityType;
  readonly entityId: string;
  readonly title: string;
  readonly content: string;
}

/** Search result with rank score and highlighted snippet. */
export interface PgSearchIndexResult {
  readonly entityType: SearchableEntityType;
  readonly entityId: string;
  readonly title: string;
  readonly content: string;
  readonly rank: number;
  readonly headline: string;
}

/** Search options for PG full-text search. */
export interface PgSearchOptions {
  readonly entityType?: SearchableEntityType;
  readonly limit?: number;
  readonly offset?: number;
}

/** Minimal database interface — works with both PgDatabase and PgliteDatabase. */
interface PgExecutable {
  execute(query: SQL): Promise<{ rows: Record<string, unknown>[] }>;
}

/** Create the search_index table (idempotent). */
export async function createSearchIndex(db: PgExecutable): Promise<void> {
  await db.execute(sql.raw(SEARCH_INDEX_DDL));
}

/** Drop the search_index table. */
export async function dropSearchIndex(db: PgExecutable): Promise<void> {
  await db.execute(sql.raw("DROP TABLE IF EXISTS search_index"));
}

/** Create indexes on search_index (idempotent). */
export async function createSearchIndexIndexes(db: PgExecutable): Promise<void> {
  await db.execute(sql.raw(SEARCH_INDEX_INDEXES_DDL));
}

/** Insert or update (upsert) a search entry. */
export async function insertSearchEntry(
  db: PgExecutable,
  entry: PgSearchIndexEntry,
): Promise<void> {
  await db.execute(
    sql`INSERT INTO search_index (system_id, entity_type, entity_id, title, content)
        VALUES (${entry.systemId}, ${entry.entityType}, ${entry.entityId}, ${entry.title}, ${entry.content})
        ON CONFLICT (system_id, entity_type, entity_id)
        DO UPDATE SET title = EXCLUDED.title, content = EXCLUDED.content`,
  );
}

/** Delete a search entry by system, entity type, and entity ID. */
export async function deleteSearchEntry(
  db: PgExecutable,
  systemId: string,
  entityType: SearchableEntityType,
  entityId: string,
): Promise<void> {
  await db.execute(
    sql`DELETE FROM search_index
        WHERE system_id = ${systemId} AND entity_type = ${entityType} AND entity_id = ${entityId}`,
  );
}

/** Drop and recreate the search index (full rebuild). */
export async function rebuildSearchIndex(db: PgExecutable): Promise<void> {
  await dropSearchIndex(db);
  await createSearchIndex(db);
}

/**
 * Search the index using PG full-text search.
 *
 * Uses `websearch_to_tsquery` for safe input parsing (handles quotes, AND/OR, -negation).
 * Returns results ranked by `ts_rank` with highlighted snippets via `ts_headline`.
 *
 * For PGlite tests (no tsvector GENERATED column), falls back to computing
 * tsvector inline in the query.
 */
export async function searchEntries(
  db: PgExecutable,
  systemId: string,
  query: string,
  opts?: PgSearchOptions,
): Promise<PgSearchIndexResult[]> {
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    return [];
  }

  const limit = opts?.limit ?? DEFAULT_SEARCH_LIMIT;
  const offset = opts?.offset ?? 0;

  const typeFilter = opts?.entityType ? sql` AND entity_type = ${opts.entityType}` : sql``;

  // Use COALESCE on search_vector to handle PGlite (where it's NULL / missing).
  // When search_vector is NULL (PGlite test DDL omits GENERATED column),
  // compute inline from title + content.
  const results = await db.execute(sql`
    SELECT
      entity_type,
      entity_id,
      title,
      content,
      ts_rank(
        COALESCE(
          search_vector,
          setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
          setweight(to_tsvector('english', coalesce(content, '')), 'B')
        ),
        websearch_to_tsquery('english', ${trimmed})
      ) AS rank,
      ts_headline(
        'english',
        coalesce(title, '') || ' ' || coalesce(content, ''),
        websearch_to_tsquery('english', ${trimmed})
      ) AS headline
    FROM search_index
    WHERE
      COALESCE(
        search_vector,
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(content, '')), 'B')
      ) @@ websearch_to_tsquery('english', ${trimmed})
      AND system_id = ${systemId}
      ${typeFilter}
    ORDER BY rank DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `);

  return results.rows.map((r) => ({
    entityType: String(r["entity_type"]) as SearchableEntityType,
    entityId: String(r["entity_id"]),
    title: String(r["title"]),
    content: String(r["content"]),
    rank: Number(r["rank"]),
    headline: String(r["headline"]),
  }));
}
