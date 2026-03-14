import { check, integer } from "drizzle-orm/sqlite-core";

import { sqliteTimestamp } from "../columns/sqlite.js";

import { archivableConsistencyCheck, versionCheck } from "./check.js";

import type { AnyColumn } from "drizzle-orm";

function _timestamps() {
  return {
    createdAt: sqliteTimestamp("created_at").notNull(),
    updatedAt: sqliteTimestamp("updated_at").notNull(),
  };
}

function _archivable() {
  return {
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    archivedAt: sqliteTimestamp("archived_at"),
  };
}

function _versioned() {
  return {
    version: integer("version").notNull().default(1),
  };
}

/** Audit timestamp columns for SQLite tables: createdAt + updatedAt. */
export function timestamps(): ReturnType<typeof _timestamps> {
  return _timestamps();
}

/** Archivable columns for SQLite tables: archived flag + nullable archivedAt. */
export function archivable(): ReturnType<typeof _archivable> {
  return _archivable();
}

/** Versioned column for SQLite tables: integer version starting at 1. */
export function versioned(): ReturnType<typeof _versioned> {
  return _versioned();
}

/**
 * Returns a named version CHECK constraint for a SQLite table.
 * Equivalent to `check(\`\${tableName}_version_check\`, versionCheck(t.version))`.
 * Pair with `versioned()` in the column definition.
 */
export function versionCheckFor(
  tableName: string,
  versionCol: AnyColumn,
): ReturnType<typeof check> {
  return check(`${tableName}_version_check`, versionCheck(versionCol));
}

/**
 * Returns a named archivable consistency CHECK constraint for a SQLite table.
 * Pair with `archivable()` in the column definition.
 */
export function archivableConsistencyCheckFor(
  tableName: string,
  archivedCol: AnyColumn,
  archivedAtCol: AnyColumn,
): ReturnType<typeof check> {
  return check(
    `${tableName}_archived_consistency_check`,
    archivableConsistencyCheck(archivedCol, archivedAtCol),
  );
}
