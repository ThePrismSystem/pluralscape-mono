import type { Brand } from "./ids.js";

/** Unix timestamp in milliseconds (e.g. `Date.now()`). */
export type UnixMillis = Brand<number, "UnixMillis">;

/** Cast a number to a branded UnixMillis timestamp. */
export function toUnixMillis(n: number): UnixMillis {
  return n as UnixMillis;
}

/** Cast a nullable number to a branded UnixMillis | null timestamp. */
export function toUnixMillisOrNull(n: number | null): UnixMillis | null {
  return n === null ? null : (n as UnixMillis);
}

/** ISO 8601 timestamp string (e.g. `"2024-01-01T00:00:00.000Z"`). */
export type ISOTimestamp = Brand<string, "ISOTimestamp">;
