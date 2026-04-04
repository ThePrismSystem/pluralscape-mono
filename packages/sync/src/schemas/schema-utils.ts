/**
 * Type-safe utility for working with branded-key Records in CRDT schemas.
 *
 * Object.keys() always returns string[] in TypeScript (microsoft/TypeScript#12936).
 * This wrapper preserves the branded key type through a single cast point,
 * avoiding scattered `as XId` casts at every iteration site.
 */

/** Returns the keys of a Record while preserving the branded key type. */
export function entityKeys<K extends string>(record: Record<K, unknown>): K[] {
  return Object.keys(record) as K[];
}
