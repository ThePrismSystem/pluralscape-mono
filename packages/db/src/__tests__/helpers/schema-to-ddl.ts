/**
 * Generates DDL from Drizzle PG schema objects for PGlite integration tests.
 *
 * Uses `getTableConfig()` to introspect tables and `SQL.inlineParams()` to
 * render CHECK constraints with literal values instead of $N placeholders.
 */
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";

import type { SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

const dialect = new PgDialect();

/** Drizzle table name symbol — used to extract the SQL table name from a table reference. */
const DRIZZLE_NAME = Symbol.for("drizzle:Name");

function renderSQL(sqlObj: SQL): string {
  const inlined = sqlObj.inlineParams();
  const query = dialect.sqlToQuery(inlined);
  return query.sql;
}

function escapeDefault(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object" && "inlineParams" in value) {
    return renderSQL(value as SQL);
  }
  const str = typeof value === "string" ? value : JSON.stringify(value);
  return `'${str.replaceAll("'", "''")}'`;
}

/** Extract the Drizzle table name from a FK reference's foreignTable. */
function getTableName(table: object): string {
  // Drizzle stores the SQL name under Symbol.for("drizzle:Name")
  const name = (table as Record<symbol, unknown>)[DRIZZLE_NAME];
  if (typeof name !== "string") throw new Error("Could not resolve table name from FK reference");
  return name;
}

/** Generate a CREATE TABLE statement from a Drizzle PG table. */
export function pgTableToCreateDDL(table: PgTable): string {
  const config = getTableConfig(table);
  const lines: string[] = [];

  // Collect composite PK column names (if any)
  const compositePkCols = new Set<string>();
  for (const pk of config.primaryKeys) {
    for (const col of pk.columns) {
      compositePkCols.add(col.name);
    }
  }

  // Columns
  for (const col of config.columns) {
    let line = `"${col.name}" ${col.getSQLType()}`;
    if (col.notNull) line += " NOT NULL";
    if (col.hasDefault) line += ` DEFAULT ${escapeDefault(col.default)}`;
    // Only add inline PRIMARY KEY for single-column PKs (not composite)
    if (col.primary && compositePkCols.size === 0) line += " PRIMARY KEY";
    if (col.isUnique) line += " UNIQUE";
    lines.push(line);
  }

  // Composite primary key
  for (const pk of config.primaryKeys) {
    const cols = pk.columns.map((c) => `"${c.name}"`).join(", ");
    lines.push(`PRIMARY KEY (${cols})`);
  }

  // Foreign keys — single-column FKs inline with the column, multi-column FKs as table constraints
  const multiColFks: Array<{
    columns: string[];
    foreignTable: string;
    foreignColumns: string[];
    onDelete: string;
    onUpdate: string;
  }> = [];

  for (const fk of config.foreignKeys) {
    const ref = fk.reference();
    const cols = ref.columns.map((c) => c.name);
    const fCols = ref.foreignColumns.map((c) => c.name);
    const fTable = getTableName(ref.foreignTable);
    const onDelete = fk.onDelete ?? "no action";
    const onUpdate = fk.onUpdate ?? "no action";

    const firstCol = cols[0];
    const firstFCol = fCols[0];
    if (cols.length === 1 && firstCol !== undefined && firstFCol !== undefined) {
      // Single-column FK — append REFERENCES to the column line
      const colIdx = lines.findIndex((l) => l.startsWith(`"${firstCol}"`));
      const existingLine = lines[colIdx];
      if (colIdx !== -1 && existingLine !== undefined) {
        const deleteClause = onDelete !== "no action" ? ` ON DELETE ${onDelete.toUpperCase()}` : "";
        const updateClause = onUpdate !== "no action" ? ` ON UPDATE ${onUpdate.toUpperCase()}` : "";
        lines[colIdx] =
          `${existingLine} REFERENCES "${fTable}"("${firstFCol}")${deleteClause}${updateClause}`;
      }
    } else {
      multiColFks.push({
        columns: cols,
        foreignTable: fTable,
        foreignColumns: fCols,
        onDelete,
        onUpdate,
      });
    }
  }

  // Multi-column foreign keys as table constraints
  for (const fk of multiColFks) {
    const cols = fk.columns.map((c) => `"${c}"`).join(", ");
    const fCols = fk.foreignColumns.map((c) => `"${c}"`).join(", ");
    let line = `FOREIGN KEY (${cols}) REFERENCES "${fk.foreignTable}"(${fCols})`;
    if (fk.onDelete !== "no action") line += ` ON DELETE ${fk.onDelete.toUpperCase()}`;
    if (fk.onUpdate !== "no action") line += ` ON UPDATE ${fk.onUpdate.toUpperCase()}`;
    lines.push(line);
  }

  // Unique constraints
  for (const uc of config.uniqueConstraints) {
    const cols = uc.columns.map((c) => `"${c.name}"`).join(", ");
    const nullsClause = uc.nullsNotDistinct ? " NULLS NOT DISTINCT" : "";
    lines.push(`UNIQUE${nullsClause} (${cols})`);
  }

  // CHECK constraints
  for (const c of config.checks) {
    const checkSql = renderSQL(c.value);
    lines.push(`CHECK (${checkSql})`);
  }

  return `CREATE TABLE "${config.name}" (\n  ${lines.join(",\n  ")}\n)`;
}

/** Generate CREATE INDEX statements from a Drizzle PG table. */
export function pgTableToIndexDDL(table: PgTable): string[] {
  const config = getTableConfig(table);
  const statements: string[] = [];

  for (const idx of config.indexes) {
    const c = idx.config;
    const unique = c.unique ? "UNIQUE " : "";
    const idxName = c.name ?? "unnamed";

    const cols = c.columns
      .map((col) => {
        if ("name" in col && typeof col.name === "string") return `"${col.name}"`;
        // Expression column — render SQL via inlineParams
        if ("inlineParams" in col && typeof col.inlineParams === "function") {
          return `(${renderSQL(col as SQL)})`;
        }
        return `("unknown")`;
      })
      .join(", ");

    let stmt = `CREATE ${unique}INDEX "${idxName}" ON "${config.name}" (${cols})`;

    if (c.where) {
      // c.where is an SQL object — render it with inlined params
      const whereSQL = renderSQL(c.where);
      stmt += ` WHERE ${whereSQL}`;
    }

    statements.push(stmt);
  }

  return statements;
}
