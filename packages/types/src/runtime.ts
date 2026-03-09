import type { ISOTimestamp, UnixMillis } from "./timestamps.js";

/** Creates a prefixed UUID as a branded string. Cast result at call site for specific ID types. */
export function createId(prefix: string): string {
  return `${prefix}${crypto.randomUUID()}`;
}

/** Returns the current Unix timestamp in milliseconds as branded UnixMillis. */
export function now(): UnixMillis {
  return Date.now() as UnixMillis;
}

/** Converts a branded UnixMillis to a branded ISOTimestamp string. */
export function toISO(ms: UnixMillis): ISOTimestamp {
  return new Date(ms).toISOString() as ISOTimestamp;
}
