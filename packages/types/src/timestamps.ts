import type { Brand } from "./ids.js";

/** Unix timestamp in milliseconds (e.g. `Date.now()`). */
export type UnixMillis = Brand<number, "UnixMillis">;

/** ISO 8601 timestamp string (e.g. `"2024-01-01T00:00:00.000Z"`). */
export type ISOTimestamp = Brand<string, "ISOTimestamp">;
