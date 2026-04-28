import {
  ENTITY_CRDT_STRATEGIES,
  type CrdtStorageType,
  type SyncedEntityType,
} from "../../strategies/crdt-strategies.js";
import { entityToRow, type EntityRow } from "../base-materializer.js";
import { getTableMetadataForEntityType } from "../drizzle-bridge.js";

/**
 * Extract entity rows from an Automerge document for a given entity type.
 *
 * Reads the storage type from `ENTITY_CRDT_STRATEGIES` and delegates to
 * the appropriate extraction strategy:
 *
 * - **lww-map / append-lww**: `doc[fieldName]` is `Record<entityId, entity>`.
 * - **singleton-lww**: `doc[fieldName]` is a single entity; uses `entityType` as synthetic ID.
 * - **junction-map**: `doc[fieldName]` is `Record<compoundKey, true>`; the key is parsed into columns.
 * - **append-only**: `doc[fieldName]` is `Record<entityId, entity>` or `entity[]`.
 */
export function extractEntities(
  entityType: SyncedEntityType,
  doc: Record<string, unknown>,
): EntityRow[] {
  const strategy = ENTITY_CRDT_STRATEGIES[entityType];
  const raw = doc[strategy.fieldName];
  if (raw === undefined || raw === null) return [];

  const meta = getTableMetadataForEntityType(entityType);

  return extractByStorageType(strategy.storageType, entityType, raw, meta.columnNames);
}

function extractByStorageType(
  storageType: CrdtStorageType,
  entityType: SyncedEntityType,
  raw: unknown,
  columnNames: readonly string[],
): EntityRow[] {
  switch (storageType) {
    case "lww-map":
    case "append-lww":
      return extractMapEntities(raw, columnNames);
    case "singleton-lww":
      return extractSingletonEntity(entityType, raw, columnNames);
    case "junction-map":
      return extractJunctionEntities(raw, columnNames);
    case "append-only":
      return extractAppendOnlyEntities(raw, columnNames);
    default: {
      const _exhaustive: never = storageType;
      return _exhaustive;
    }
  }
}

/** lww-map and append-lww: Record<entityId, entityObject> */
function extractMapEntities(raw: unknown, columnNames: readonly string[]): EntityRow[] {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return [];
  const rows: EntityRow[] = [];
  for (const [entityId, entity] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof entity !== "object" || entity === null || Array.isArray(entity)) continue;
    rows.push(entityToRow(entityId, entity as Record<string, unknown>, columnNames));
  }
  return rows;
}

/** singleton-lww: single entity object, synthetic ID from entityType */
function extractSingletonEntity(
  entityType: SyncedEntityType,
  raw: unknown,
  columnNames: readonly string[],
): EntityRow[] {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return [];
  const entity = raw as Record<string, unknown>;
  const id = typeof entity["id"] === "string" ? entity["id"] : entityType;
  return [entityToRow(id, entity, columnNames)];
}

/** junction-map: Record<compoundKey, true> — key IS the entity */
function extractJunctionEntities(raw: unknown, columnNames: readonly string[]): EntityRow[] {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return [];
  const rows: EntityRow[] = [];
  for (const compoundKey of Object.keys(raw as Record<string, unknown>)) {
    const parts = compoundKey.split("_");
    if (parts.length < 2) continue;
    const entityObj: Record<string, unknown> = {};
    // For junction maps, the non-id column names (excluding "id") map to the key parts
    const nonIdColumns = columnNames.filter((c) => c !== "id");
    for (let i = 0; i < nonIdColumns.length && i < parts.length; i++) {
      entityObj[nonIdColumns[i] ?? ""] = parts[i];
    }
    rows.push({ id: compoundKey, ...entityObj } as EntityRow);
  }
  return rows;
}

/** append-only: Record<entityId, entity> or entity[] */
function extractAppendOnlyEntities(raw: unknown, columnNames: readonly string[]): EntityRow[] {
  if (Array.isArray(raw)) {
    const rows: EntityRow[] = [];
    for (const entity of raw) {
      if (typeof entity !== "object" || entity === null) continue;
      const obj = entity as Record<string, unknown>;
      const id = typeof obj["id"] === "string" ? obj["id"] : String(rows.length);
      rows.push(entityToRow(id, obj, columnNames));
    }
    return rows;
  }
  // Fall back to map extraction for Record<entityId, entity>
  return extractMapEntities(raw, columnNames);
}
