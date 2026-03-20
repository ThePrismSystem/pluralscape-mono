/**
 * Shared utilities for SQLite-backed sync adapters.
 *
 * Bun's SQLite driver returns Buffer (a Uint8Array subclass) for BLOB columns.
 * This utility normalises to plain Uint8Array so branded type assertions and
 * constructor checks work correctly downstream.
 */

/**
 * Ensure a BLOB value is a plain Uint8Array (not a Buffer subclass).
 *
 * When `buf` is already a plain Uint8Array, returns it unchanged.
 * When `buf` is a Buffer (or other Uint8Array subclass), copies to a new Uint8Array.
 */
export function toUint8Array(buf: Uint8Array): Uint8Array {
  return buf.constructor === Uint8Array ? buf : new Uint8Array(buf);
}
