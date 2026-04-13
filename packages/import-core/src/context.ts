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
import { MAX_WARNING_BUFFER_SIZE } from "./import-core.constants.js";

import type { SourceMode } from "./source.types.js";
import type { ImportEntityType, ImportFailureKind } from "@pluralscape/types";

export interface MappingWarning {
  readonly entityType: ImportEntityType;
  readonly entityId: string | null;
  readonly kind?: ImportFailureKind;
  /** Deduplication key used by addWarningOnce. */
  readonly key?: string;
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
  /**
   * Append a warning to the buffer at most once per `dedupeKey`. Subsequent
   * calls with the same `dedupeKey` are no-ops. Use this for "field dropped"
   * warnings where one notice per import run is enough — `addWarning` is for
   * per-occurrence anomalies that should be surfaced individually.
   */
  addWarningOnce(dedupeKey: string, warning: MappingWarning): void;
  /** Store arbitrary metadata alongside a translation entry. */
  storeMetadata(entityType: ImportEntityType, sourceId: string, key: string, value: unknown): void;
  /** Retrieve metadata previously stored via storeMetadata. Returns undefined if not found. */
  getMetadata(entityType: ImportEntityType, sourceId: string, key: string): unknown;
}

/**
 * Index of the final slot reserved for the {@link TRUNCATED_MARKER}. When a
 * call to `addWarning`/`addWarningOnce` would push past
 * `MAX_WARNING_BUFFER_SIZE - 1`, we instead emit the marker into the last
 * slot and drop subsequent warnings. This keeps the buffer bounded at
 * exactly `MAX_WARNING_BUFFER_SIZE` entries while still signalling loss to
 * downstream consumers.
 */
const WARNING_BUFFER_RESERVED_SLOT = MAX_WARNING_BUFFER_SIZE - 1;

/**
 * Create a {@link MappingContext}.
 *
 * Memory characteristics: the IdTranslationTable grows one entry per
 * successfully-mapped entity across the whole run (keyed by entityType and
 * source ID). There is intentionally no eviction — later mappers resolve
 * foreign keys against earlier passes, so the table must survive until the
 * entire DEPENDENCY_ORDER walk is complete. In practice this is bounded by
 * the number of source documents in the export; personal systems are a few
 * thousand rows at most (~100 bytes/entry), so the table stays comfortably
 * under 1 MB. Pathological multi-MB imports should be surfaced via import
 * job telemetry rather than evicting mid-run (which would break FK
 * resolution). Warnings, by contrast, are bounded by
 * {@link MAX_WARNING_BUFFER_SIZE} with a truncation marker.
 */
export function createMappingContext(opts: { sourceMode: SourceMode }): MappingContext {
  const tables = new Map<ImportEntityType, Map<string, string>>();
  const metadata = new Map<string, unknown>();
  const warnings: MappingWarning[] = [];
  const seenWarningKinds = new Set<string>();
  let truncatedMarkerEmitted = false;

  function tableFor(entityType: ImportEntityType): Map<string, string> {
    let table = tables.get(entityType);
    if (!table) {
      table = new Map();
      tables.set(entityType, table);
    }
    return table;
  }

  function maybeEmitTruncatedMarker(): void {
    if (truncatedMarkerEmitted) return;
    truncatedMarkerEmitted = true;
    warnings.push({
      entityType: "unknown",
      entityId: null,
      kind: "warnings-truncated",
      key: "warnings-truncated",
      message: `Warnings buffer exceeded ${String(MAX_WARNING_BUFFER_SIZE)}; further warnings dropped`,
    });
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
      if (warnings.length >= WARNING_BUFFER_RESERVED_SLOT) {
        maybeEmitTruncatedMarker();
        return;
      }
      warnings.push(warning);
    },
    addWarningOnce(dedupeKey, warning) {
      if (seenWarningKinds.has(dedupeKey)) return;
      if (warnings.length >= WARNING_BUFFER_RESERVED_SLOT) {
        maybeEmitTruncatedMarker();
        return;
      }
      seenWarningKinds.add(dedupeKey);
      warnings.push(warning);
    },
    storeMetadata(entityType, sourceId, key, value) {
      metadata.set(`${entityType}:${sourceId}:${key}`, value);
    },
    getMetadata(entityType, sourceId, key) {
      return metadata.get(`${entityType}:${sourceId}:${key}`);
    },
  };
}
