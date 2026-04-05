import { ENTITY_TABLE_REGISTRY } from "@pluralscape/sync/materializer";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import type { LocalDatabase } from "../data/local-database.js";
import type { SyncedEntityType } from "@pluralscape/sync";
import type { UseQueryResult } from "@tanstack/react-query";

// ── Types ─────────────────────────────────────────────────────────────

export type SearchScope = "self" | "friends" | "all";

export interface SearchResult {
  readonly type: string;
  readonly id: string;
  readonly rank: number;
  readonly data: Record<string, unknown>;
}

// ── Searchable entity lists ───────────────────────────────────────────

/**
 * Entity types that have FTS columns defined — these are searchable.
 */
const SEARCHABLE_ENTITY_TYPES: readonly SyncedEntityType[] = (
  Object.keys(ENTITY_TABLE_REGISTRY) as SyncedEntityType[]
).filter((entityType) => ENTITY_TABLE_REGISTRY[entityType].ftsColumns.length > 0);

/**
 * The set of entity types whose data is shared with friends.
 * Mirrors FRIEND_EXPORTABLE_ENTITY_TYPES in friend-indexer.ts.
 */
const FRIEND_SEARCHABLE_ENTITY_TYPES = new Set<SyncedEntityType>([
  "member",
  "group",
  "channel",
  "message",
  "note",
  "poll",
  "relationship",
  "structure-entity-type",
  "structure-entity",
  "journal-entry",
  "wiki-page",
  "custom-front",
  "fronting-session",
  "board-message",
  "acknowledgement",
  "innerworld-entity",
  "innerworld-region",
  "field-definition",
  "field-value",
  "member-photo",
  "fronting-comment",
]);

// ── Query builder ─────────────────────────────────────────────────────

/**
 * Builds a tokenized FTS5 query with prefix matching.
 * "alice bob" → "alice* bob*"
 */
function buildFtsQuery(query: string): string {
  return query
    .trim()
    .split(/\s+/)
    .map((word) => `${word}*`)
    .join(" ");
}

/**
 * Executes a single FTS5 search against one table and returns typed results.
 */
function searchTable(
  db: LocalDatabase,
  entityType: string,
  tableName: string,
  ftsName: string,
  ftsQuery: string,
): SearchResult[] {
  const sql =
    `SELECT ${tableName}.*, ${ftsName}.rank ` +
    `FROM ${ftsName} ` +
    `JOIN ${tableName} ON ${tableName}.rowid = ${ftsName}.rowid ` +
    `WHERE ${ftsName} MATCH ? ` +
    `ORDER BY ${ftsName}.rank ` +
    `LIMIT 20`;

  const rows = db.queryAll(sql, [ftsQuery]);

  return rows.map((row) => {
    const { rank, ...data } = row;
    const id = typeof row["id"] === "string" ? row["id"] : String(row["id"]);
    return {
      type: entityType,
      id,
      rank: typeof rank === "number" ? rank : 0,
      data,
    };
  });
}

// ── Core search function (non-React, testable independently) ──────────

/**
 * Executes FTS5 search across local SQLite tables.
 *
 * @param db - Local SQLite database instance
 * @param query - Raw search string from the user
 * @param scope - "self" queries own data, "friends" queries friend data, "all" queries both
 * @returns Results sorted by FTS5 rank (lower = more relevant)
 */
export function executeSearch(
  db: LocalDatabase,
  query: string,
  scope: SearchScope,
): SearchResult[] {
  if (query.trim().length === 0) {
    return [];
  }

  const ftsQuery = buildFtsQuery(query);
  const results: SearchResult[] = [];

  for (const entityType of SEARCHABLE_ENTITY_TYPES) {
    const def = ENTITY_TABLE_REGISTRY[entityType];
    const { tableName } = def;

    if (scope === "self" || scope === "all") {
      const ftsName = `fts_${tableName}`;
      const rows = searchTable(db, entityType, tableName, ftsName, ftsQuery);
      results.push(...rows);
    }

    if (
      (scope === "friends" || scope === "all") &&
      FRIEND_SEARCHABLE_ENTITY_TYPES.has(entityType)
    ) {
      const ftsName = `fts_friend_${tableName}`;
      const friendEntityType = `friend-${entityType}`;
      const friendTableName = `friend_${tableName}`;
      const rows = searchTable(db, friendEntityType, friendTableName, ftsName, ftsQuery);
      results.push(...rows);
    }
  }

  // Sort by rank ascending (lower FTS5 rank = more relevant)
  return results.sort((a, b) => a.rank - b.rank);
}

// ── Debounce helper ───────────────────────────────────────────────────

function useDebouncedValue(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value);
    }, delay);
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);
  return debounced;
}

// ── React hook wrapper ────────────────────────────────────────────────

/**
 * React Query hook for FTS5 local search.
 *
 * Debounces the query (300ms) before executing against the local SQLite FTS5
 * indexes. Pass a `LocalDatabase` instance obtained from the data layer context.
 *
 * @param db - Local database instance (from DataLayerProvider / useDataLayer)
 * @param query - Raw search string
 * @param scope - Search scope: "self", "friends", or "all" (default: "all")
 */
export function useSearch(
  db: LocalDatabase,
  query: string,
  scope: SearchScope = "all",
): UseQueryResult<SearchResult[]> {
  const debouncedQuery = useDebouncedValue(query, 300);

  return useQuery({
    queryKey: ["search", debouncedQuery, scope],
    queryFn: () => executeSearch(db, debouncedQuery, scope),
    enabled: debouncedQuery.length > 0,
  });
}
