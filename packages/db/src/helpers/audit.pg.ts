import { boolean, integer } from "drizzle-orm/pg-core";

import { pgTimestamp } from "../columns/pg.js";

function _pgTimestamps() {
  return {
    createdAt: pgTimestamp("created_at").notNull(),
    updatedAt: pgTimestamp("updated_at").notNull(),
  };
}

function _pgArchivable() {
  return {
    archived: boolean("archived").notNull().default(false),
    archivedAt: pgTimestamp("archived_at"),
  };
}

function _pgVersioned() {
  return {
    version: integer("version").notNull().default(1),
  };
}

/** Audit timestamp columns for PG tables: createdAt + updatedAt. */
export function timestamps(): ReturnType<typeof _pgTimestamps> {
  return _pgTimestamps();
}

/** Archivable columns for PG tables: archived flag + nullable archivedAt. */
export function archivable(): ReturnType<typeof _pgArchivable> {
  return _pgArchivable();
}

/** Versioned column for PG tables: integer version starting at 1. */
export function versioned(): ReturnType<typeof _pgVersioned> {
  return _pgVersioned();
}
