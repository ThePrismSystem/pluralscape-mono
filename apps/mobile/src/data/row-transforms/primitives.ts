/**
 * Row transform functions for local SQLite reads.
 *
 * Each transform accepts a raw `Record<string, unknown>` SQLite row and
 * returns a strongly-typed domain object. Guarded primitive helpers validate
 * every field at runtime and throw `RowTransformError` with table/field/rowId
 * context on type mismatches, making corrupt rows debuggable.
 *
 * Conventions:
 * - INTEGER columns storing booleans (0/1) are converted to `boolean`.
 * - TEXT columns storing JSON-serialized arrays or objects are parsed.
 * - Timestamps (INTEGER, Unix ms) are validated as numbers and branded.
 * - `archivedAt` is not stored in SQLite; always `null` in local rows.
 * - `version` is not stored in SQLite; always `0` in local rows.
 *
 * For E2E-encrypted entities the local SQLite holds the **plaintext** fields
 * (materialized from the CRDT document), not an `encryptedData` blob. The
 * returned types therefore omit `encryptedData` and include the plain fields
 * directly, matching the decrypted domain shape.
 */

import type { Archived, SystemSettings, UnixMillis } from "@pluralscape/types";

// ── Primitive helpers ────────────────────────────────────────────────────────

/** Error thrown when a SQLite row field fails a runtime type guard. */
export class RowTransformError extends Error {
  readonly table: string;
  readonly field: string;
  readonly rowId: string | null;

  constructor(table: string, field: string, rowId: string | null, message: string) {
    super(`${table}.${field}${rowId !== null ? " (row " + rowId + ")" : ""}: ${message}`);
    this.name = "RowTransformError";
    this.table = table;
    this.field = field;
    this.rowId = rowId;
  }
}

/** Coerce a 0/1 INTEGER column to boolean. */
export function intToBool(v: unknown): boolean {
  return v === 1 || v === true;
}

/**
 * Coerce a 0/1 INTEGER column to boolean, fail-closed for privacy fields.
 * Returns `true` when value is null or undefined (maximum restriction).
 */
export function intToBoolFailClosed(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  return intToBool(v);
}

/**
 * Parse a JSON-serialized TEXT column. Returns `null` for null/undefined.
 * Non-strings pass through. Throws `RowTransformError` for malformed JSON.
 */
export function parseJsonSafe(
  v: unknown,
  table: string,
  field: string,
  rowId?: string | null,
): unknown {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return v;
  try {
    return JSON.parse(v) as unknown;
  } catch {
    const truncated = v.length > 80 ? v.slice(0, 80) + "…" : v;
    throw new RowTransformError(table, field, rowId ?? null, `invalid JSON: ${truncated}`);
  }
}

/**
 * Parse a JSON-serialized TEXT column that is guaranteed non-null in the schema.
 * Non-strings pass through. Throws `RowTransformError` for malformed JSON.
 */
export function parseJsonRequired(
  v: unknown,
  table: string,
  field: string,
  rowId?: string | null,
): unknown {
  if (typeof v !== "string") return v;
  try {
    return JSON.parse(v) as unknown;
  } catch {
    const truncated = v.length > 80 ? v.slice(0, 80) + "…" : v;
    throw new RowTransformError(table, field, rowId ?? null, `invalid JSON: ${truncated}`);
  }
}

/** Parse a JSON-serialized TEXT column as a string array. */
export function parseStringArray(
  v: unknown,
  table: string,
  field: string,
  rowId?: string | null,
): readonly string[] {
  return parseJsonRequired(v, table, field, rowId) as readonly string[];
}

/** Parse a nullable JSON-serialized TEXT column as a string array. */
export function parseStringArrayOrNull(
  v: unknown,
  table: string,
  field: string,
  rowId?: string | null,
): readonly string[] | null {
  return parseJsonSafe(v, table, field, rowId) as readonly string[] | null;
}

/**
 * Validate and cast to `UnixMillis`. Throws `RowTransformError` if the value
 * is not a number.
 */
export function guardedToMs(
  v: unknown,
  table: string,
  field: string,
  rowId?: string | null,
): UnixMillis {
  if (typeof v !== "number") {
    throw new RowTransformError(table, field, rowId ?? null, `expected number, got ${typeof v}`);
  }
  return v as UnixMillis;
}

/** Cast to `UnixMillis` or null. */
export function toMsOrNull(
  v: unknown,
  table: string,
  field: string,
  rowId?: string | null,
): UnixMillis | null {
  if (v === null || v === undefined) return null;
  return guardedToMs(v, table, field, rowId);
}

/** Validate and cast to `string`. Throws `RowTransformError` if not a string. */
export function guardedStr(
  v: unknown,
  table: string,
  field: string,
  rowId?: string | null,
): string {
  if (typeof v !== "string") {
    throw new RowTransformError(table, field, rowId ?? null, `expected string, got ${typeof v}`);
  }
  return v;
}

/** Cast to string or null. */
export function strOrNull(
  v: unknown,
  table: string,
  field: string,
  rowId?: string | null,
): string | null {
  if (v === null || v === undefined) return null;
  return guardedStr(v, table, field, rowId);
}

/** Validate and cast to `number`. Throws `RowTransformError` if not a number. */
export function guardedNum(
  v: unknown,
  table: string,
  field: string,
  rowId?: string | null,
): number {
  if (typeof v !== "number") {
    throw new RowTransformError(table, field, rowId ?? null, `expected number, got ${typeof v}`);
  }
  return v;
}

/** Cast to number or null. */
export function numOrNull(
  v: unknown,
  table: string,
  field: string,
  rowId?: string | null,
): number | null {
  if (v === null || v === undefined) return null;
  return guardedNum(v, table, field, rowId);
}

// ── ID extractor ─────────────────────────────────────────────────────────────

/** Extract the row's primary key as a string for error context. */
export function rid(row: Record<string, unknown>): string | null {
  const v = row["id"];
  return typeof v === "string" ? v : null;
}

// ── Archived wrapping helpers ─────────────────────────────────────────────────

/**
 * Wrap a domain object as Archived<T> using the row's updated_at as
 * archivedAt proxy. Only call when the row's `archived` column is 1.
 */
export function wrapArchived<T extends { readonly archived: false }>(
  base: T,
  archivedAt: UnixMillis,
): Archived<T> {
  // Object.assign overwrites `archived: false` with `archived: true` without
  // needing a destructure (which would produce an unused-var lint error).
  return Object.assign({}, base, { archived: true as const, archivedAt }) as Archived<T>;
}

// ── Transform functions ──────────────────────────────────────────────────────

// ── system-core ──────────────────────────────────────────────────────────────

export function rowToSystemSettings(row: Record<string, unknown>): SystemSettings {
  const id = rid(row);
  return {
    id: guardedStr(row["id"], "system_settings", "id", id) as SystemSettings["id"],
    systemId: guardedStr(
      row["system_id"],
      "system_settings",
      "system_id",
      id,
    ) as SystemSettings["systemId"],
    theme: guardedStr(row["theme"], "system_settings", "theme", id) as SystemSettings["theme"],
    fontScale: guardedNum(row["font_scale"], "system_settings", "font_scale", id),
    locale: strOrNull(row["locale"], "system_settings", "locale", id) as SystemSettings["locale"],
    defaultBucketId: strOrNull(
      row["default_bucket_id"],
      "system_settings",
      "default_bucket_id",
      id,
    ) as SystemSettings["defaultBucketId"],
    appLock: parseJsonRequired(
      row["app_lock"],
      "system_settings",
      "app_lock",
      id,
    ) as SystemSettings["appLock"],
    notifications: parseJsonRequired(
      row["notifications"],
      "system_settings",
      "notifications",
      id,
    ) as SystemSettings["notifications"],
    syncPreferences: parseJsonRequired(
      row["sync_preferences"],
      "system_settings",
      "sync_preferences",
      id,
    ) as SystemSettings["syncPreferences"],
    privacyDefaults: parseJsonRequired(
      row["privacy_defaults"],
      "system_settings",
      "privacy_defaults",
      id,
    ) as SystemSettings["privacyDefaults"],
    littlesSafeMode: parseJsonRequired(
      row["littles_safe_mode"],
      "system_settings",
      "littles_safe_mode",
      id,
    ) as SystemSettings["littlesSafeMode"],
    nomenclature: parseJsonRequired(
      row["nomenclature"],
      "system_settings",
      "nomenclature",
      id,
    ) as SystemSettings["nomenclature"],
    saturationLevelsEnabled: intToBool(row["saturation_levels_enabled"]),
    autoCaptureFrontingOnJournal: intToBool(row["auto_capture_fronting_on_journal"]),
    snapshotSchedule: parseJsonRequired(
      row["snapshot_schedule"],
      "system_settings",
      "snapshot_schedule",
      id,
    ) as SystemSettings["snapshotSchedule"],
    onboardingComplete: intToBool(row["onboarding_complete"]),
    createdAt: guardedToMs(row["created_at"], "system_settings", "created_at", id),
    updatedAt: guardedToMs(row["updated_at"], "system_settings", "updated_at", id),
    version: 0,
  };
}
