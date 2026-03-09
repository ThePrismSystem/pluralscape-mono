import { integer } from "drizzle-orm/sqlite-core";

import { sqliteTimestamp } from "../columns/sqlite.js";

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
