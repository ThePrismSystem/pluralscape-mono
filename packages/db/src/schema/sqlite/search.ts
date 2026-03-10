import { sql } from "drizzle-orm";

import type { SearchableEntityType } from "@pluralscape/types";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const DEFAULT_SEARCH_LIMIT = 50;

/** FTS5 virtual table DDL for client-side full-text search. */
export const SEARCH_INDEX_DDL = `
  CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
    entity_type,
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

/** Search options. */
export interface SearchOptions {
  readonly entityType?: SearchableEntityType;
  readonly limit?: number;
}

/** Search the index using FTS5 MATCH, returning ranked results. */
export function searchEntries(
  db: BetterSQLite3Database,
  query: string,
  opts?: SearchOptions,
): SearchIndexResult[] {
  const limit = opts?.limit ?? DEFAULT_SEARCH_LIMIT;

  if (opts?.entityType) {
    const results = db.all<{
      entity_type: string;
      entity_id: string;
      title: string;
      content: string;
      rank: number;
    }>(
      sql`SELECT entity_type, entity_id, title, content, rank FROM search_index WHERE search_index MATCH ${query} AND entity_type = ${opts.entityType} ORDER BY rank LIMIT ${limit}`,
    );
    return results.map((r) => ({
      entityType: r.entity_type as SearchableEntityType,
      entityId: r.entity_id,
      title: r.title,
      content: r.content,
      rank: r.rank,
    }));
  }

  const results = db.all<{
    entity_type: string;
    entity_id: string;
    title: string;
    content: string;
    rank: number;
  }>(
    sql`SELECT entity_type, entity_id, title, content, rank FROM search_index WHERE search_index MATCH ${query} ORDER BY rank LIMIT ${limit}`,
  );
  return results.map((r) => ({
    entityType: r.entity_type as SearchableEntityType,
    entityId: r.entity_id,
    title: r.title,
    content: r.content,
    rank: r.rank,
  }));
}
