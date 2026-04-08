/**
 * MappingContext — shared state passed to every mapper.
 *
 * Holds the `IdTranslationTable` (source-ID → Pluralscape-ID lookup), a bounded
 * warnings buffer, and the source mode (some mappers log differently for api vs
 * file vs fake).
 *
 * Mappers read from the translation table to resolve foreign keys that earlier
 * passes already mapped (e.g., a member's group IDs are resolved against the
 * group pass's registrations). They add warnings for recoverable anomalies that
 * should be surfaced in the import summary but not halt the run.
 *
 * The warnings buffer is capped at {@link MAX_WARNING_BUFFER_SIZE} to prevent
 * unbounded memory growth during pathological imports.
 */
import { MAX_WARNING_BUFFER_SIZE } from "../import-sp.constants.js";

import type { SourceMode } from "../sources/source.types.js";
import type { ImportEntityType } from "@pluralscape/types";

export interface MappingWarning {
  readonly entityType: ImportEntityType;
  readonly entityId: string | null;
  readonly message: string;
}

export interface IdTranslationEntry {
  readonly sourceId: string;
  readonly pluralscapeId: string;
}

export interface MappingContext {
  readonly sourceMode: SourceMode;
  /** Read-only view of accumulated warnings. */
  readonly warnings: readonly MappingWarning[];
  translate(entityType: ImportEntityType, sourceId: string): string | null;
  register(entityType: ImportEntityType, sourceId: string, pluralscapeId: string): void;
  registerMany(entityType: ImportEntityType, entries: readonly IdTranslationEntry[]): void;
  addWarning(warning: MappingWarning): void;
}

export function createMappingContext(opts: { sourceMode: SourceMode }): MappingContext {
  const tables = new Map<ImportEntityType, Map<string, string>>();
  const warnings: MappingWarning[] = [];

  function tableFor(entityType: ImportEntityType): Map<string, string> {
    let table = tables.get(entityType);
    if (!table) {
      table = new Map();
      tables.set(entityType, table);
    }
    return table;
  }

  return {
    sourceMode: opts.sourceMode,
    get warnings(): readonly MappingWarning[] {
      return warnings;
    },
    translate(entityType, sourceId) {
      return tableFor(entityType).get(sourceId) ?? null;
    },
    register(entityType, sourceId, pluralscapeId) {
      tableFor(entityType).set(sourceId, pluralscapeId);
    },
    registerMany(entityType, entries) {
      const table = tableFor(entityType);
      for (const entry of entries) {
        table.set(entry.sourceId, entry.pluralscapeId);
      }
    },
    addWarning(warning) {
      if (warnings.length >= MAX_WARNING_BUFFER_SIZE) return;
      warnings.push(warning);
    },
  };
}
