import { getTableConfig } from "drizzle-orm/sqlite-core";

import { ENTITY_CRDT_STRATEGIES, type SyncedEntityType } from "../strategies/crdt-strategies.js";

import { getTableMetadataForEntityType } from "./drizzle-bridge.js";
import { ENTITY_METADATA, FRIEND_EXPORTABLE_ENTITY_TYPES } from "./entity-metadata.js";

import type { Column } from "drizzle-orm";

interface ColumnSpec {
  readonly name: string;
  readonly sqlType: string;
  readonly primaryKey: boolean;
  readonly notNull: boolean;
}

const CONNECTION_ID_COLUMN: ColumnSpec = {
  name: "connection_id",
  sqlType: "TEXT",
  primaryKey: false,
  notNull: true,
};

function columnSpecFromDrizzle(col: Column): ColumnSpec {
  return {
    name: col.name,
    sqlType: col.getSQLType().toUpperCase(),
    primaryKey: col.primary,
    notNull: col.notNull,
  };
}

function columnSpecToSql(col: ColumnSpec): string {
  const parts: string[] = [col.name, col.sqlType];
  if (col.primaryKey) parts.push("PRIMARY KEY");
  if (col.notNull) parts.push("NOT NULL");
  return parts.join(" ");
}

function buildCreateTable(tableName: string, columns: readonly ColumnSpec[]): string {
  const colDefs = columns.map(columnSpecToSql).join(", ");
  return `CREATE TABLE IF NOT EXISTS ${tableName} (${colDefs})`;
}

function buildEntityTable(entityType: SyncedEntityType): string {
  const meta = getTableMetadataForEntityType(entityType);
  const columns = getTableConfig(meta.drizzleTable).columns.map(columnSpecFromDrizzle);
  return buildCreateTable(meta.tableName, columns);
}

function buildFriendTable(entityType: SyncedEntityType): string {
  const meta = getTableMetadataForEntityType(entityType);
  const columns = getTableConfig(meta.drizzleTable).columns.map(columnSpecFromDrizzle);
  return buildCreateTable(`friend_${meta.tableName}`, [CONNECTION_ID_COLUMN, ...columns]);
}

// ── FTS helpers ───────────────────────────────────────────────────────

function buildFtsVirtualTable(tableName: string, ftsColumns: readonly string[]): string {
  const cols = ftsColumns.join(", ");
  return (
    `CREATE VIRTUAL TABLE IF NOT EXISTS fts_${tableName} ` +
    `USING fts5(${cols}, content='${tableName}', content_rowid='rowid', tokenize='porter unicode61')`
  );
}

function buildFtsTriggers(tableName: string, ftsColumns: readonly string[]): string[] {
  const ftsTable = `fts_${tableName}`;
  const newCols = ftsColumns.map((c) => `new.${c}`).join(", ");
  const oldCols = ftsColumns.map((c) => `old.${c}`).join(", ");
  const cols = ftsColumns.join(", ");

  const insertTrigger =
    `CREATE TRIGGER ${tableName}_fts_ai AFTER INSERT ON ${tableName} BEGIN\n` +
    `  INSERT INTO ${ftsTable}(rowid, ${cols}) VALUES (new.rowid, ${newCols});\n` +
    `END`;

  const deleteTrigger =
    `CREATE TRIGGER ${tableName}_fts_ad AFTER DELETE ON ${tableName} BEGIN\n` +
    `  INSERT INTO ${ftsTable}(${ftsTable}, rowid, ${cols}) VALUES ('delete', old.rowid, ${oldCols});\n` +
    `END`;

  const updateTrigger =
    `CREATE TRIGGER ${tableName}_fts_au AFTER UPDATE ON ${tableName} BEGIN\n` +
    `  INSERT INTO ${ftsTable}(${ftsTable}, rowid, ${cols}) VALUES ('delete', old.rowid, ${oldCols});\n` +
    `  INSERT INTO ${ftsTable}(rowid, ${cols}) VALUES (new.rowid, ${newCols});\n` +
    `END`;

  return [insertTrigger, deleteTrigger, updateTrigger];
}

// ── Public API ────────────────────────────────────────────────────────

const ENTITY_TYPES = Object.keys(ENTITY_CRDT_STRATEGIES) as readonly SyncedEntityType[];

/**
 * Generates the `crdt_documents` binary store table plus all entity
 * tables (own + friend_ variants) as `CREATE TABLE IF NOT EXISTS` DDL.
 * Schema is derived from the Drizzle cache schemas via introspection.
 */
export function generateSchemaStatements(): string[] {
  const stmts: string[] = [];

  stmts.push(
    "CREATE TABLE IF NOT EXISTS crdt_documents (document_id TEXT PRIMARY KEY, document_type TEXT NOT NULL, binary BLOB NOT NULL, last_merged_at INTEGER NOT NULL)",
  );

  for (const entityType of ENTITY_TYPES) {
    stmts.push(buildEntityTable(entityType));

    if (FRIEND_EXPORTABLE_ENTITY_TYPES.has(entityType)) {
      stmts.push(buildFriendTable(entityType));
    }
  }

  return stmts;
}

/**
 * Generates FTS5 virtual tables and their INSERT/UPDATE/DELETE triggers
 * for every entity (and friend_ variant) that declares `ftsColumns`.
 */
export function generateFtsStatements(): string[] {
  const stmts: string[] = [];

  for (const entityType of ENTITY_TYPES) {
    const ftsColumns = ENTITY_METADATA[entityType].ftsColumns;
    if (ftsColumns.length === 0) continue;

    const meta = getTableMetadataForEntityType(entityType);
    stmts.push(buildFtsVirtualTable(meta.tableName, ftsColumns));
    stmts.push(...buildFtsTriggers(meta.tableName, ftsColumns));

    if (FRIEND_EXPORTABLE_ENTITY_TYPES.has(entityType)) {
      const friendTableName = `friend_${meta.tableName}`;
      stmts.push(buildFtsVirtualTable(friendTableName, ftsColumns));
      stmts.push(...buildFtsTriggers(friendTableName, ftsColumns));
    }
  }

  return stmts;
}

/**
 * Returns all DDL statements in dependency order:
 * schema tables first, then FTS virtual tables and triggers.
 */
export function generateAllDdl(): string[] {
  return [...generateSchemaStatements(), ...generateFtsStatements()];
}
