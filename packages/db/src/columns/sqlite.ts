import { customType } from "drizzle-orm/sqlite-core";

// ── Mapping functions (exported for independent testing) ───────

/** SQLite timestamp: passthrough (integer to integer). */
export function timestampToDriver(ms: number): number {
  return ms;
}

/** SQLite timestamp: passthrough (integer to integer). */
export function timestampFromDriver(val: number): number {
  return val;
}

/** SQLite JSON: stringify for text storage. */
export function jsonToDriver(val: unknown): string {
  return JSON.stringify(val);
}

/** SQLite JSON: parse from text storage. */
export function jsonFromDriver(val: string): unknown {
  return JSON.parse(val) as unknown;
}

// ── Custom column types ────────────────────────────────────────

/** SQLite integer column that stores UnixMillis (passthrough). */
export const sqliteTimestamp = customType<{ data: number; driverData: number }>({
  dataType() {
    return "integer";
  },
  toDriver: timestampToDriver,
  fromDriver: timestampFromDriver,
});

/** SQLite blob column that maps to/from Uint8Array (passthrough). */
export const sqliteBinary = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType() {
    return "blob";
  },
});

/** SQLite text column that stores JSON (stringify/parse). */
export const sqliteJson = customType<{ data: unknown; driverData: string }>({
  dataType() {
    return "text";
  },
  toDriver: jsonToDriver,
  fromDriver: jsonFromDriver,
});
