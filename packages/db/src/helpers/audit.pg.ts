import { boolean, integer } from "drizzle-orm/pg-core";

import { pgTimestamp } from "../columns/pg.js";

function _timestamps() {
  return {
    createdAt: pgTimestamp("created_at").notNull(),
    updatedAt: pgTimestamp("updated_at").notNull(),
  };
}

function _archivable() {
  return {
    archived: boolean("archived").notNull().default(false),
    archivedAt: pgTimestamp("archived_at"),
  };
}

function _versioned() {
  return {
    version: integer("version").notNull().default(1),
  };
}

/** Audit timestamp columns for PG tables: createdAt + updatedAt. */
export function timestamps(): ReturnType<typeof _timestamps> {
  return _timestamps();
}

/** Archivable columns for PG tables: archived flag + nullable archivedAt. */
export function archivable(): ReturnType<typeof _archivable> {
  return _archivable();
}

/** Versioned column for PG tables: integer version starting at 1. */
export function versioned(): ReturnType<typeof _versioned> {
  return _versioned();
}
