import type { Brand } from "./ids.js";

/** Unix timestamp in milliseconds (e.g. `Date.now()`). */
export type UnixMillis = Brand<number, "UnixMillis">;

/** Cast a number to a branded UnixMillis timestamp. Throws on NaN/Infinity. */
export function toUnixMillis(n: number): UnixMillis {
  if (!Number.isFinite(n)) {
    throw new TypeError(`Expected finite number for UnixMillis, got: ${String(n)}`);
  }
  return n as UnixMillis;
}

/** Cast a nullable number to a branded UnixMillis | null timestamp. Throws on NaN/Infinity. */
export function toUnixMillisOrNull(n: number | null): UnixMillis | null {
  if (n === null) return null;
  if (!Number.isFinite(n)) {
    throw new TypeError(`Expected finite number for UnixMillis, got: ${String(n)}`);
  }
  return n as UnixMillis;
}

/** ISO 8601 timestamp string (e.g. `"2024-01-01T00:00:00.000Z"`). */
export type ISOTimestamp = Brand<string, "ISOTimestamp">;
