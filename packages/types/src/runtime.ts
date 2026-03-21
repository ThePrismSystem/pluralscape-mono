import { toUnixMillis } from "./timestamps.js";

import type { ISOTimestamp, UnixMillis } from "./timestamps.js";

/** Creates a prefixed UUID as a branded string. Prefix must be non-empty and end with `_`. */
export function createId(prefix: string): string {
  if (prefix === "") {
    throw new Error("ID prefix must not be empty");
  }
  if (!prefix.endsWith("_")) {
    throw new Error(`ID prefix must end with '_', got "${prefix}"`);
  }
  return `${prefix}${crypto.randomUUID()}`;
}

/** Returns the current Unix timestamp in milliseconds as branded UnixMillis. */
export function now(): UnixMillis {
  return toUnixMillis(Date.now());
}

/** Converts a branded UnixMillis to a branded ISOTimestamp string. */
export function toISO(ms: UnixMillis): ISOTimestamp {
  return new Date(ms).toISOString() as ISOTimestamp;
}

/** Extracts a human-readable message from an unknown caught value. */
export function extractErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
