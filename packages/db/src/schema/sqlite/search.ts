import { sql } from "drizzle-orm";

import { parseSearchableEntityType } from "../../helpers/enums.js";

import type { SearchableEntityType } from "@pluralscape/types";
// Intentionally typed for better-sqlite3 (self-hosted tier); mobile app will need its own FTS5 wrapper.
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const DEFAULT_SEARCH_LIMIT = 50;
const MAX_SEARCH_LIMIT = 1000;

/**
 * FTS5 virtual table DDL for client-side full-text search.
 *
 * No system_id column: SQLite is single-tenant (one user, one system per database).
 * See packages/db/docs/dialect-api-guide.md "SQLite Single-Tenant Isolation Model".
 */
export const SEARCH_INDEX_DDL = `
  CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
    entity_type UNINDEXED,
    entity_id UNINDEXED,
    title,
    content,
    tokenize='unicode61'
  )
`;

/** Shape of a search index entry. */
export interface SearchIndexEntry {
  readonly entityType: SearchableEntityType;
  readonly entityId: string;
  readonly title: string;
  readonly content: string;
}

/** Search result with FTS5 rank score. */
export interface SearchIndexResult {
  readonly entityType: SearchableEntityType;
  readonly entityId: string;
  readonly title: string;
  readonly content: string;
  readonly rank: number;
}

/** Create the FTS5 search_index virtual table. */
export function createSearchIndex(db: BetterSQLite3Database): void {
  db.run(sql.raw(SEARCH_INDEX_DDL));
}

/** Drop the FTS5 search_index virtual table. */
export function dropSearchIndex(db: BetterSQLite3Database): void {
  db.run(sql.raw("DROP TABLE IF EXISTS search_index"));
}

/** Insert a single entry into the search index. */
export function insertSearchEntry(db: BetterSQLite3Database, entry: SearchIndexEntry): void {
  db.run(
    sql`INSERT INTO search_index (entity_type, entity_id, title, content) VALUES (${entry.entityType}, ${entry.entityId}, ${entry.title}, ${entry.content})`,
  );
}

/** Delete an entry from the search index by entity type and ID. */
export function deleteSearchEntry(
  db: BetterSQLite3Database,
  entityType: SearchableEntityType,
  entityId: string,
): void {
  db.run(
    sql`DELETE FROM search_index WHERE entity_type = ${entityType} AND entity_id = ${entityId}`,
  );
}

/** Drop and recreate the search index. */
export function rebuildSearchIndex(db: BetterSQLite3Database): void {
  dropSearchIndex(db);
  createSearchIndex(db);
}

/**
 * Sanitize user input for safe FTS5 MATCH usage.
 * Escapes double quotes and wraps in double quotes so FTS5 treats the input as a literal phrase.
 * Returns null for empty/whitespace-only input.
 */
export function sanitizeFtsQuery(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return `"${trimmed.replace(/"/g, '""')}"`;
}

/** Search options. */
export interface SearchOptions {
  readonly entityType?: SearchableEntityType;
  readonly limit?: number;
}

interface RawSearchRow {
  entity_type: string;
  entity_id: string;
  title: string;
  content: string;
  rank: number;
}

function mapSearchRow(r: RawSearchRow): SearchIndexResult {
  return {
    entityType: parseSearchableEntityType(r.entity_type),
    entityId: r.entity_id,
    title: r.title,
    content: r.content,
    rank: r.rank,
  };
}

/** Sanitize a query string for FTS5 MATCH by wrapping in double quotes (phrase query). */
function sanitizeFts5Query(query: string): string {
  return '"' + query.replace(/"/g, '""') + '"';
}

/** Search the index using FTS5 MATCH, returning ranked results. */
export function searchEntries(
  db: BetterSQLite3Database,
  query: string,
  opts?: SearchOptions,
): SearchIndexResult[] {
  const limit = Math.max(1, Math.min(opts?.limit ?? DEFAULT_SEARCH_LIMIT, MAX_SEARCH_LIMIT));
  const safeQuery = sanitizeFts5Query(query);

  const typeFilter = opts?.entityType ? sql` AND entity_type = ${opts.entityType}` : sql``;

  const results = db.all<RawSearchRow>(
    sql`SELECT entity_type, entity_id, title, content, rank FROM search_index WHERE search_index MATCH ${safeQuery}${typeFilter} ORDER BY rank LIMIT ${limit}`,
  );
  return results.map(mapSearchRow);
}
