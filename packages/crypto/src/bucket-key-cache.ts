import { getSodium } from "./sodium.js";

import type { AeadKey } from "./types.js";
import type { BucketId } from "@pluralscape/types";

/**
 * In-memory cache for decrypted bucket keys.
 *
 * Keys are zeroed via memzero when removed or replaced. Callers must NOT
 * memzero a key obtained from `get()` — the cache owns the reference.
 */
export interface BucketKeyCache {
  get(bucketId: BucketId): AeadKey | undefined;
  set(bucketId: BucketId, key: AeadKey): void;
  delete(bucketId: BucketId): void;
  has(bucketId: BucketId): boolean;
  clearAll(): void;
  readonly size: number;
}

/** Create a new in-memory bucket key cache backed by a Map. */
export function createBucketKeyCache(): BucketKeyCache {
  const store = new Map<BucketId, AeadKey>();

  return {
    get(bucketId: BucketId): AeadKey | undefined {
      return store.get(bucketId);
    },

    set(bucketId: BucketId, key: AeadKey): void {
      const existing = store.get(bucketId);
      if (existing !== undefined) {
        getSodium().memzero(existing);
      }
      store.set(bucketId, key);
    },

    delete(bucketId: BucketId): void {
      const existing = store.get(bucketId);
      if (existing !== undefined) {
        getSodium().memzero(existing);
        store.delete(bucketId);
      }
    },

    has(bucketId: BucketId): boolean {
      return store.has(bucketId);
    },

    clearAll(): void {
      const adapter = getSodium();
      for (const key of store.values()) {
        adapter.memzero(key);
      }
      store.clear();
    },

    get size(): number {
      return store.size;
    },
  };
}
