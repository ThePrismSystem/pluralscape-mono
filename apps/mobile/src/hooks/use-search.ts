import {
  ENTITY_TABLE_REGISTRY,
  FRIEND_EXPORTABLE_ENTITY_TYPES,
} from "@pluralscape/sync/materializer";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import type { LocalDatabase } from "../data/local-database.js";
import type { SyncedEntityType } from "@pluralscape/sync";
import type { UseQueryResult } from "@tanstack/react-query";

// ── Types ─────────────────────────────────────────────────────────────

export type UiSearchScope = "self" | "friends" | "all";

export interface SearchResult {
  readonly type: SyncedEntityType | `friend-${SyncedEntityType}`;
  readonly id: string;
  readonly rank: number;
  readonly data: Record<string, unknown>;
}

// ── Constants ─────────────────────────────────────────────────────────

/** Debounce delay for search input (ms). */
const SEARCH_DEBOUNCE_MS = 300;

/** Maximum results per entity type per FTS5 query. */
const SEARCH_RESULTS_LIMIT = 20;

// ── Searchable entity lists ───────────────────────────────────────────

/**
 * Entity types that have FTS columns defined — these are searchable.
 */
const SEARCHABLE_ENTITY_TYPES: readonly SyncedEntityType[] = (
  Object.keys(ENTITY_TABLE_REGISTRY) as SyncedEntityType[]
).filter((entityType) => ENTITY_TABLE_REGISTRY[entityType].ftsColumns.length > 0);

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
async function searchTable(
  db: LocalDatabase,
  entityType: SyncedEntityType | `friend-${SyncedEntityType}`,
  tableName: string,
  ftsName: string,
  ftsQuery: string,
): Promise<SearchResult[]> {
  const sql =
    `SELECT ${tableName}.*, ${ftsName}.rank ` +
    `FROM ${ftsName} ` +
    `JOIN ${tableName} ON ${tableName}.rowid = ${ftsName}.rowid ` +
    `WHERE ${ftsName} MATCH ? ` +
    `ORDER BY ${ftsName}.rank ` +
    `LIMIT ${String(SEARCH_RESULTS_LIMIT)}`;

  const rows = await db.queryAll(sql, [ftsQuery]);

  return rows.map((row): SearchResult => {
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
export async function executeSearch(
  db: LocalDatabase,
  query: string,
  scope: UiSearchScope,
): Promise<SearchResult[]> {
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
      const rows = await searchTable(db, entityType, tableName, ftsName, ftsQuery);
      results.push(...rows);
    }

    if (
      (scope === "friends" || scope === "all") &&
      FRIEND_EXPORTABLE_ENTITY_TYPES.has(entityType)
    ) {
      const ftsName = `fts_friend_${tableName}`;
      const friendEntityType: `friend-${SyncedEntityType}` = `friend-${entityType}`;
      const friendTableName = `friend_${tableName}`;
      const rows = await searchTable(db, friendEntityType, friendTableName, ftsName, ftsQuery);
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
  scope: UiSearchScope = "all",
): UseQueryResult<SearchResult[]> {
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);

  return useQuery({
    queryKey: ["search", debouncedQuery, scope],
    queryFn: () => executeSearch(db, debouncedQuery, scope),
    enabled: debouncedQuery.length > 0,
  });
}
