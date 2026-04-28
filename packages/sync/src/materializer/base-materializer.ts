import type { SyncDocumentType } from "../document-types.js";
import type { MaterializerTableMetadata } from "./drizzle-bridge.js";
import type { EntityOperation } from "../event-bus/event-map.js";
import type { EventBus, DataLayerEventMap } from "../event-bus/index.js";
import type { SyncedEntityType } from "../strategies/crdt-strategies.js";

// ── Public types ──────────────────────────────────────────────────────

export type EntityRow = Record<string, unknown> & { id: string };

export interface DiffResult {
  readonly inserts: readonly EntityRow[];
  readonly updates: readonly EntityRow[];
  readonly deletes: readonly string[];
}

export interface MaterializerDb {
  queryAll<T>(sql: string, params: unknown[]): T[];
  execute(sql: string, params: unknown[]): void;
  transaction<T>(fn: () => T): T;
}

// ── diffEntities ──────────────────────────────────────────────────────

/**
 * Diff two arrays of `EntityRow` by ID.
 *
 * Comparison is done by JSON-serializing all non-`id` fields so that
 * deep equality is handled without a dependency on a comparison library.
 *
 * Both sides are materialised into `Map<id, hash>` in a single pass each,
 * then compared directly — rowHash is called exactly once per row on either
 * side. If `incoming` contains duplicate ids, the last occurrence wins
 * (last-write-wins via the incoming map) and earlier duplicates are silently
 * dropped — callers must not rely on ordering when passing duplicates.
 */
export function diffEntities(
  current: readonly EntityRow[],
  incoming: readonly EntityRow[],
): DiffResult {
  const currentMap = new Map<string, string>();
  for (const row of current) {
    currentMap.set(row.id, rowHash(row));
  }

  const incomingMap = new Map<string, { row: EntityRow; hash: string }>();
  for (const row of incoming) {
    incomingMap.set(row.id, { row, hash: rowHash(row) });
  }

  const inserts: EntityRow[] = [];
  const updates: EntityRow[] = [];
  for (const [id, { row, hash }] of incomingMap) {
    const existingHash = currentMap.get(id);
    if (existingHash === undefined) {
      inserts.push(row);
    } else if (existingHash !== hash) {
      updates.push(row);
    }
  }

  const deletes: string[] = [];
  for (const id of currentMap.keys()) {
    if (!incomingMap.has(id)) {
      deletes.push(id);
    }
  }

  return { inserts, updates, deletes };
}

/** JSON-serialize all fields except `id` for equality comparison. */
function rowHash(row: EntityRow): string {
  const fields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (key !== "id") fields[key] = value;
  }
  return JSON.stringify(fields);
}

// ── toSnakeCase ───────────────────────────────────────────────────────

/**
 * Convert a camelCase string to snake_case.
 *
 * @example toSnakeCase("displayName") // "display_name"
 */
export function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
}

// ── entityToRow ───────────────────────────────────────────────────────

/**
 * Convert an Automerge entity (camelCase keys) to an `EntityRow` (snake_case keys).
 *
 * Arrays and objects are JSON-serialized. Only columns present in `columnNames`
 * are included in the output.
 */
export function entityToRow(
  id: string,
  entity: Record<string, unknown>,
  columnNames: readonly string[],
): EntityRow {
  const columnSet = new Set(columnNames);
  const row: Record<string, unknown> = { id };

  for (const [camelKey, value] of Object.entries(entity)) {
    const snakeKey = toSnakeCase(camelKey);
    if (!columnSet.has(snakeKey)) continue;

    if (Array.isArray(value) || (value !== null && typeof value === "object")) {
      row[snakeKey] = JSON.stringify(value);
    } else {
      row[snakeKey] = value;
    }
  }

  return row as EntityRow;
}

// ── applyDiff ─────────────────────────────────────────────────────────

/** Emit materialized:entity events for hot-path entity types. */
function emitEntityEvents(
  eventBus: EventBus<DataLayerEventMap>,
  documentType: SyncDocumentType,
  entityType: SyncedEntityType,
  ids: readonly string[],
  op: EntityOperation,
): void {
  for (const entityId of ids) {
    eventBus.emit("materialized:entity", {
      type: "materialized:entity",
      documentType,
      entityType,
      entityId,
      op,
    });
  }
}

/**
 * Apply a `DiffResult` to the local SQLite database.
 *
 * - Skips if the diff is empty.
 * - Uses `INSERT OR REPLACE INTO` for inserts and updates.
 * - Uses `DELETE FROM … WHERE id = ?` for deletes.
 * - Wraps all writes in a single transaction.
 * - Emits `materialized:entity` events for each change when `hotPath` is true.
 *   Document-level events are NOT emitted here — the caller is responsible for that.
 */
export function applyDiff(
  db: MaterializerDb,
  meta: MaterializerTableMetadata,
  entityType: SyncedEntityType,
  documentType: SyncDocumentType,
  diff: DiffResult,
  eventBus: EventBus<DataLayerEventMap>,
  hotPath: boolean,
): void {
  if (diff.inserts.length === 0 && diff.updates.length === 0 && diff.deletes.length === 0) {
    return;
  }

  const { tableName, columnNames } = meta;

  db.transaction(() => {
    for (const row of diff.inserts) {
      upsertRow(db, tableName, columnNames, row);
    }
    for (const row of diff.updates) {
      upsertRow(db, tableName, columnNames, row);
    }
    for (const id of diff.deletes) {
      db.execute(`DELETE FROM ${tableName} WHERE id = ?`, [id]);
    }
  });

  if (hotPath) {
    emitEntityEvents(
      eventBus,
      documentType,
      entityType,
      diff.inserts.map((r) => r.id),
      "create",
    );
    emitEntityEvents(
      eventBus,
      documentType,
      entityType,
      diff.updates.map((r) => r.id),
      "update",
    );
    emitEntityEvents(eventBus, documentType, entityType, diff.deletes, "delete");
  }
}

/** Build and execute an `INSERT OR REPLACE INTO` statement for a single row. */
function upsertRow(
  db: MaterializerDb,
  tableName: string,
  columnNames: readonly string[],
  row: EntityRow,
): void {
  const presentColumns = columnNames.filter((col) => col in row);
  const placeholders = presentColumns.map(() => "?").join(", ");
  const sql = `INSERT OR REPLACE INTO ${tableName} (${presentColumns.join(", ")}) VALUES (${placeholders})`;
  const params = presentColumns.map((col) => row[col] ?? null);
  db.execute(sql, params);
}
