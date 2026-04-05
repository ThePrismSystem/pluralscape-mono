import {
  ENTITY_TABLE_REGISTRY,
  FRIEND_EXPORTABLE_ENTITY_TYPES,
  type ColumnDef,
  type EntityTableDef,
} from "./entity-registry.js";

import type { SyncedEntityType } from "../strategies/crdt-strategies.js";

/** Column injected at position 0 for every friend_ table. */
const CONNECTION_ID_COLUMN: ColumnDef = {
  name: "connection_id",
  sqlType: "TEXT",
  notNull: true,
};

// ── DDL helpers ───────────────────────────────────────────────────────

function columnToSql(col: ColumnDef): string {
  const parts: string[] = [col.name, col.sqlType];
  if (col.primaryKey) parts.push("PRIMARY KEY");
  if (col.notNull) parts.push("NOT NULL");
  return parts.join(" ");
}

function buildCreateTable(tableName: string, columns: readonly ColumnDef[]): string {
  const colDefs = columns.map(columnToSql).join(", ");
  return `CREATE TABLE IF NOT EXISTS ${tableName} (${colDefs})`;
}

function buildEntityTable(def: EntityTableDef): string {
  return buildCreateTable(def.tableName, def.columns);
}

function buildFriendTable(def: EntityTableDef): string {
  const friendTableName = `friend_${def.tableName}`;
  const columns: readonly ColumnDef[] = [CONNECTION_ID_COLUMN, ...def.columns];
  return buildCreateTable(friendTableName, columns);
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

/**
 * Generates the `crdt_documents` binary store table plus all entity
 * tables (own + friend_ variants) as `CREATE TABLE IF NOT EXISTS` DDL.
 */
export function generateSchemaStatements(): string[] {
  const stmts: string[] = [];

  stmts.push(
    "CREATE TABLE IF NOT EXISTS crdt_documents (document_id TEXT PRIMARY KEY, document_type TEXT NOT NULL, binary BLOB NOT NULL, last_merged_at INTEGER NOT NULL)",
  );

  for (const [entityType, def] of Object.entries(ENTITY_TABLE_REGISTRY) as [
    SyncedEntityType,
    EntityTableDef,
  ][]) {
    stmts.push(buildEntityTable(def));

    if (FRIEND_EXPORTABLE_ENTITY_TYPES.has(entityType)) {
      stmts.push(buildFriendTable(def));
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

  for (const [entityType, def] of Object.entries(ENTITY_TABLE_REGISTRY) as [
    SyncedEntityType,
    EntityTableDef,
  ][]) {
    if (def.ftsColumns.length > 0) {
      stmts.push(buildFtsVirtualTable(def.tableName, def.ftsColumns));
      stmts.push(...buildFtsTriggers(def.tableName, def.ftsColumns));
    }

    if (FRIEND_EXPORTABLE_ENTITY_TYPES.has(entityType) && def.ftsColumns.length > 0) {
      const friendTableName = `friend_${def.tableName}`;
      stmts.push(buildFtsVirtualTable(friendTableName, def.ftsColumns));
      stmts.push(...buildFtsTriggers(friendTableName, def.ftsColumns));
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
