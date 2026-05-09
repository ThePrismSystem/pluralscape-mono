import type { ServerInternal, StorageKey } from "@pluralscape/types";

/**
 * Re-brand helpers for the `storage_key` column.
 *
 * The `blob_metadata.storage_key` column is branded `ServerInternal<string>`
 * (so `Serialize<>` strips it from wire payloads). External callers and
 * storage adapters use the peer brand `StorageKey`. Both brands are
 * structurally `string` plus a different phantom marker — they don't
 * intersect in TypeScript's eyes, but at runtime they're identical.
 *
 * These helpers swap brands at a single, named boundary so call sites
 * stay free of per-site type assertions.
 */

/**
 * Tag a `StorageKey` (or any plain `string`) as the
 * `ServerInternal<string>` brand the Drizzle column carries.
 *
 * Compile-time only — no runtime effect.
 */
export function asInternalStorageKey(key: string): ServerInternal<string> {
  return key as ServerInternal<string>;
}

/**
 * Drop the `ServerInternal<string>` brand on a value read from a Drizzle
 * column, retagging it as the public-facing `StorageKey` brand consumed by
 * the storage adapter.
 *
 * Compile-time only — no runtime effect.
 */
export function asStorageKey(internalKey: string): StorageKey {
  return internalKey as StorageKey;
}
