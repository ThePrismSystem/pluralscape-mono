import { customType } from "drizzle-orm/pg-core";

// ── Mapping functions (exported for independent testing) ───────

/** Converts UnixMillis to ISO string for PG timestamptz storage. */
export function timestampToDriver(ms: number): string {
  return new Date(ms).toISOString();
}

/** Converts PG timestamptz string back to UnixMillis. */
export function timestampFromDriver(val: string): number {
  return Date.parse(val);
}

/** Converts Uint8Array to Buffer for PG bytea storage. */
export function binaryToDriver(val: Uint8Array): Buffer {
  return Buffer.from(val);
}

/** Converts PG bytea Buffer back to Uint8Array. */
export function binaryFromDriver(val: Buffer): Uint8Array {
  return new Uint8Array(val);
}

/** Converts JSON object to string for storage. */
export function jsonToDriver(val: unknown): string {
  return JSON.stringify(val);
}

/** Parses JSON string from storage. */
export function jsonFromDriver(val: string): unknown {
  return JSON.parse(val) as unknown;
}

// ── Custom column types ────────────────────────────────────────

/** PG timestamptz column that maps to/from UnixMillis (number). */
export const pgTimestamp = customType<{ data: number; driverData: string }>({
  dataType() {
    return "timestamptz";
  },
  toDriver: timestampToDriver,
  fromDriver: timestampFromDriver,
});

/** PG bytea column that maps to/from Uint8Array. */
export const pgBinary = customType<{ data: Uint8Array; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
  toDriver: binaryToDriver,
  fromDriver: binaryFromDriver,
});

/** PG jsonb column that maps to/from parsed JSON. */
export const pgJsonb = customType<{ data: unknown; driverData: string }>({
  dataType() {
    return "jsonb";
  },
  toDriver: jsonToDriver,
  fromDriver: jsonFromDriver,
});
