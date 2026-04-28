import { getTableName, is, SQL } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/sqlite-core";

import { ENTITY_CRDT_STRATEGIES, type SyncedEntityType } from "../strategies/crdt-strategies.js";

import { getTableMetadataForEntityType } from "./drizzle-bridge.js";
import { ENTITY_METADATA, FRIEND_EXPORTABLE_ENTITY_TYPES } from "./entity-metadata.js";

import type { Column } from "drizzle-orm";
import type {
  Check,
  ForeignKey,
  Index,
  PrimaryKey,
  UniqueConstraint,
} from "drizzle-orm/sqlite-core";

// ── Column / constraint formatters ───────────────────────────────────

function formatDefaultLiteral(value: unknown): string {
  if (value === null) return "NULL";
  if (typeof value === "string") return `'${value.replaceAll("'", "''")}'`;
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  throw new Error(`Cannot format DEFAULT literal of type ${typeof value}`);
}

function formatColumn(col: Column): string {
  const parts: string[] = [col.name, col.getSQLType().toUpperCase()];
  if (col.primary) parts.push("PRIMARY KEY");
  if (col.notNull) parts.push("NOT NULL");
  if (col.hasDefault && col.default !== undefined) {
    if (is(col.default, SQL)) {
      throw new Error(
        `Column ${col.name} uses an SQL-expression default; cache schemas must use literal defaults`,
      );
    }
    parts.push(`DEFAULT ${formatDefaultLiteral(col.default)}`);
  }
  return parts.join(" ");
}

function formatPrimaryKey(pk: PrimaryKey): string {
  const cols = pk.columns.map((c) => c.name).join(", ");
  return `PRIMARY KEY (${cols})`;
}

function formatForeignKey(fk: ForeignKey): string {
  const ref = fk.reference();
  const cols = ref.columns.map((c) => c.name).join(", ");
  const fcols = ref.foreignColumns.map((c) => c.name).join(", ");
  const ftable = getTableName(ref.foreignTable);
  const segments = [`FOREIGN KEY (${cols}) REFERENCES ${ftable}(${fcols})`];
  if (fk.onDelete) segments.push(`ON DELETE ${fk.onDelete.toUpperCase()}`);
  if (fk.onUpdate) segments.push(`ON UPDATE ${fk.onUpdate.toUpperCase()}`);
  return segments.join(" ");
}

function formatUniqueConstraint(uc: UniqueConstraint): string {
  const cols = uc.columns.map((c) => c.name).join(", ");
  return `UNIQUE (${cols})`;
}

function formatCheck(chk: Check): string {
  // SQL.toQuery() requires a dialect, which we don't have here. The cache
  // schemas don't currently use CHECK constraints; throw if one appears so
  // the user wires up dialect-aware emission rather than silently dropping it.
  throw new Error(
    `CHECK constraint "${chk.name}" cannot be emitted without dialect support; add SQL serialization if needed`,
  );
}

function formatIndex(tableName: string, idx: Index): string {
  const { name, columns, unique } = idx.config;
  const colNames = columns.map((c) => {
    if (is(c, SQL)) {
      throw new Error(`Index ${name} on ${tableName} uses an SQL-expression column; not supported`);
    }
    return c.name;
  });
  const kind = unique ? "UNIQUE INDEX" : "INDEX";
  return `CREATE ${kind} IF NOT EXISTS ${name} ON ${tableName} (${colNames.join(", ")})`;
}

// ── Table builders ───────────────────────────────────────────────────

interface TableBuildInput {
  readonly tableName: string;
  readonly extraColumnLines: readonly string[];
  readonly columns: readonly Column[];
  readonly primaryKeys: readonly PrimaryKey[];
  readonly foreignKeys: readonly ForeignKey[];
  readonly uniqueConstraints: readonly UniqueConstraint[];
  readonly checks: readonly Check[];
}

function buildCreateTable(input: TableBuildInput): string {
  const lines: string[] = [
    ...input.extraColumnLines,
    ...input.columns.map(formatColumn),
    ...input.primaryKeys.map(formatPrimaryKey),
    ...input.foreignKeys.map(formatForeignKey),
    ...input.uniqueConstraints.map(formatUniqueConstraint),
    ...input.checks.map(formatCheck),
  ];
  return `CREATE TABLE IF NOT EXISTS ${input.tableName} (${lines.join(", ")})`;
}

function buildEntityTable(entityType: SyncedEntityType): { create: string; indexes: string[] } {
  const meta = getTableMetadataForEntityType(entityType);
  const config = getTableConfig(meta.drizzleTable);
  const create = buildCreateTable({
    tableName: meta.tableName,
    extraColumnLines: [],
    columns: config.columns,
    primaryKeys: config.primaryKeys,
    foreignKeys: config.foreignKeys,
    uniqueConstraints: config.uniqueConstraints,
    checks: config.checks,
  });
  const indexes = config.indexes.map((i) => formatIndex(meta.tableName, i));
  return { create, indexes };
}

function buildFriendTable(entityType: SyncedEntityType): { create: string; indexes: string[] } {
  const meta = getTableMetadataForEntityType(entityType);
  const config = getTableConfig(meta.drizzleTable);
  const friendTableName = `friend_${meta.tableName}`;
  // Friend tables drop FKs (referenced rows live in own-system tables, not
  // friend mirrors) but keep the column shape and PK/UNIQUE/CHECK constraints.
  const create = buildCreateTable({
    tableName: friendTableName,
    extraColumnLines: ["connection_id TEXT NOT NULL"],
    columns: config.columns,
    primaryKeys: config.primaryKeys,
    foreignKeys: [],
    uniqueConstraints: config.uniqueConstraints,
    checks: config.checks,
  });
  const indexes = config.indexes.map((i) => formatIndex(friendTableName, i));
  return { create, indexes };
}

// ── FTS helpers ──────────────────────────────────────────────────────

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

// ── Public API ───────────────────────────────────────────────────────

const ENTITY_TYPES = Object.keys(ENTITY_CRDT_STRATEGIES) as readonly SyncedEntityType[];

/**
 * Generates the `crdt_documents` binary store table plus all entity tables
 * (own + friend_ variants) and their indexes as DDL. Schema is derived from
 * the Drizzle cache schemas via `getTableConfig`: column shape, defaults,
 * PRIMARY KEY (single + composite), FOREIGN KEY clauses (with ON DELETE),
 * UNIQUE constraints, and CREATE INDEX statements all flow from one source.
 */
export function generateSchemaStatements(): string[] {
  const stmts: string[] = [];

  stmts.push(
    "CREATE TABLE IF NOT EXISTS crdt_documents (document_id TEXT PRIMARY KEY, document_type TEXT NOT NULL, binary BLOB NOT NULL, last_merged_at INTEGER NOT NULL)",
  );

  for (const entityType of ENTITY_TYPES) {
    const own = buildEntityTable(entityType);
    stmts.push(own.create, ...own.indexes);

    if (FRIEND_EXPORTABLE_ENTITY_TYPES.has(entityType)) {
      const friend = buildFriendTable(entityType);
      stmts.push(friend.create, ...friend.indexes);
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
