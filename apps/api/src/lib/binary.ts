/**
 * Ensure a value is a proper Uint8Array.
 *
 * Drizzle's pgBinary columns may return Buffer (Node) or Uint8Array depending
 * on the driver. This normalizes the result for crypto functions that require
 * Uint8Array.
 */
export function ensureUint8Array(buf: Uint8Array): Uint8Array {
  return buf instanceof Uint8Array ? buf : new Uint8Array(buf);
}
