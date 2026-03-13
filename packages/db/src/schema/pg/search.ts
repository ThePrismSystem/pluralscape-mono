import { sql } from "drizzle-orm";

import { getDeploymentMode } from "../../deployment.js";
import { parseSearchableEntityType } from "../../helpers/enums.js";

import type { DeploymentMode } from "../../deployment.js";
import type { SearchableEntityType, SystemId } from "@pluralscape/types";
import type { SQL } from "drizzle-orm";

const DEFAULT_SEARCH_LIMIT = 50;
const MAX_SEARCH_LIMIT = 1000;

/**
 * Asserts that plaintext search operations are only performed in self-hosted mode.
 * Throws in hosted mode to prevent storing plaintext in a cloud environment.
 */
function assertSelfHosted(mode?: DeploymentMode): void {
  const resolved = mode ?? getDeploymentMode();
  if (resolved === "hosted") {
    throw new Error("Plaintext search_index is not available in hosted mode (see ADR 018)");
  }
}

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
    system_id VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(50) NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    search_vector tsvector GENERATED ALWAYS AS (
      setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(content, '')), 'B')
    ) STORED,
    PRIMARY KEY (system_id, entity_type, entity_id)
  )
`;

/** GIN index on tsvector and composite B-tree index on (system_id, entity_type). */
export const SEARCH_INDEX_INDEXES_DDL = `
  CREATE INDEX IF NOT EXISTS search_index_vector_idx ON search_index USING GIN (search_vector);
  CREATE INDEX IF NOT EXISTS search_index_system_entity_type_idx ON search_index (system_id, entity_type)
`;

/** Shape of a search index entry (input). */
export interface PgSearchIndexEntry {
  readonly systemId: SystemId;
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

/**
 * Create the search_index table (idempotent).
 *
 * IMPORTANT: After calling this function, the caller must also apply RLS policies
 * via `generateRlsStatements("search_index")`. The search_index is created via raw
 * DDL (not Drizzle migrations), so RLS is not automatically applied.
 */
export async function createSearchIndex(
  db: PgExecutable,
  deploymentMode?: DeploymentMode,
): Promise<void> {
  assertSelfHosted(deploymentMode);
  await db.execute(sql.raw(SEARCH_INDEX_DDL));
}

/**
 * Drop the search_index table.
 * Intentionally unguarded: dropping is safe in any mode, and a hosted deployment
 * may need to purge a residual table.
 */
export async function dropSearchIndex(db: PgExecutable): Promise<void> {
  await db.execute(sql.raw("DROP TABLE IF EXISTS search_index"));
}

/** Create indexes on search_index (idempotent). Guarded: indexes only make sense if the table exists. */
export async function createSearchIndexIndexes(
  db: PgExecutable,
  deploymentMode?: DeploymentMode,
): Promise<void> {
  assertSelfHosted(deploymentMode);
  await db.execute(sql.raw(SEARCH_INDEX_INDEXES_DDL));
}

/** Insert or update (upsert) a search entry. */
export async function insertSearchEntry(
  db: PgExecutable,
  entry: PgSearchIndexEntry,
  deploymentMode?: DeploymentMode,
): Promise<void> {
  assertSelfHosted(deploymentMode);
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
  systemId: SystemId,
  entityType: SearchableEntityType,
  entityId: string,
): Promise<void> {
  await db.execute(
    sql`DELETE FROM search_index
        WHERE system_id = ${systemId} AND entity_type = ${entityType} AND entity_id = ${entityId}`,
  );
}

/**
 * Drop and recreate the search index with indexes (full rebuild).
 * Guards before drop to avoid leaving the table in a dropped state if mode is wrong.
 * createSearchIndex/createSearchIndexIndexes re-check internally (defense-in-depth).
 */
export async function rebuildSearchIndex(
  db: PgExecutable,
  deploymentMode?: DeploymentMode,
): Promise<void> {
  assertSelfHosted(deploymentMode);
  await dropSearchIndex(db);
  await createSearchIndex(db, deploymentMode);
  await createSearchIndexIndexes(db, deploymentMode);
}

/**
 * Search the index using PG full-text search.
 *
 * Uses `websearch_to_tsquery` for safe input parsing (handles quotes, AND/OR, -negation).
 * Returns results ranked by `ts_rank` with highlighted snippets via `ts_headline`.
 *
 * The search_vector column is always populated (GENERATED in production, trigger in PGlite tests),
 * so the query hits the GIN index directly.
 */
export async function searchEntries(
  db: PgExecutable,
  systemId: SystemId,
  query: string,
  opts?: PgSearchOptions,
): Promise<PgSearchIndexResult[]> {
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    return [];
  }

  const limit = Math.max(1, Math.min(opts?.limit ?? DEFAULT_SEARCH_LIMIT, MAX_SEARCH_LIMIT));
  const offset = Math.max(0, opts?.offset ?? 0);

  const typeFilter = opts?.entityType ? sql` AND entity_type = ${opts.entityType}` : sql``;

  const results = await db.execute(sql`
    SELECT
      entity_type,
      entity_id,
      title,
      content,
      ts_rank(
        search_vector,
        websearch_to_tsquery('english', ${trimmed})
      ) AS rank,
      ts_headline(
        'english',
        coalesce(title, '') || ' ' || coalesce(content, ''),
        websearch_to_tsquery('english', ${trimmed})
      ) AS headline
    FROM search_index
    WHERE
      search_vector @@ websearch_to_tsquery('english', ${trimmed})
      AND system_id = ${systemId}
      ${typeFilter}
    ORDER BY rank DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `);

  return results.rows.map((r) => {
    const entityId = r["entity_id"];
    const title = r["title"];
    const content = r["content"];
    const headline = r["headline"];
    return {
      entityType: parseSearchableEntityType(r["entity_type"]),
      entityId: typeof entityId === "string" ? entityId : "",
      title: typeof title === "string" ? title : "",
      content: typeof content === "string" ? content : "",
      rank: Number(r["rank"]),
      headline: typeof headline === "string" ? headline : "",
    };
  });
}
