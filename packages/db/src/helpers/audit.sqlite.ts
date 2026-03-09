import { integer } from "drizzle-orm/sqlite-core";

import { sqliteTimestamp } from "../columns/sqlite.js";

function _sqliteTimestamps() {
  return {
    createdAt: sqliteTimestamp("created_at").notNull(),
    updatedAt: sqliteTimestamp("updated_at").notNull(),
  };
}

function _sqliteArchivable() {
  return {
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    archivedAt: sqliteTimestamp("archived_at"),
  };
}

function _sqliteVersioned() {
  return {
    version: integer("version").notNull().default(1),
  };
}

/** Audit timestamp columns for SQLite tables: createdAt + updatedAt. */
export function timestamps(): ReturnType<typeof _sqliteTimestamps> {
  return _sqliteTimestamps();
}

/** Archivable columns for SQLite tables: archived flag + nullable archivedAt. */
export function archivable(): ReturnType<typeof _sqliteArchivable> {
  return _sqliteArchivable();
}

/** Versioned column for SQLite tables: integer version starting at 1. */
export function versioned(): ReturnType<typeof _sqliteVersioned> {
  return _sqliteVersioned();
}
