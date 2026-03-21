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

  /** Get a specific key version for a bucket (used during key rotation). */
  getByVersion(bucketId: BucketId, keyVersion: number): AeadKey | undefined;
  /** Store a versioned key for a bucket (used during key rotation). */
  setVersioned(bucketId: BucketId, keyVersion: number, key: AeadKey): void;
  /** Delete a specific versioned key for a bucket. */
  deleteVersion(bucketId: BucketId, keyVersion: number): void;
}

/** Options for creating a bucket key cache. */
export interface BucketKeyCacheOptions {
  /**
   * Maximum number of entries in the main store. When exceeded, the
   * least-recently-used entry is evicted (and memzeroed). Omit for unbounded.
   * Versioned store uses `maxSize * 2` as its budget.
   */
  readonly maxSize?: number;
}

/** Versioned store budget multiplier (each bucket may have old+new during rotation). */
const VERSIONED_BUDGET_MULTIPLIER = 2;

/**
 * Evict the oldest entry (first in Map insertion order) from a Map,
 * memzeroing the evicted key material.
 */
function evictOldest<K>(map: Map<K, AeadKey>): void {
  const first = map.entries().next();
  if (!first.done) {
    getSodium().memzero(first.value[1]);
    map.delete(first.value[0]);
  }
}

/** Create a new in-memory bucket key cache backed by a Map. */
export function createBucketKeyCache(options?: BucketKeyCacheOptions): BucketKeyCache {
  const store = new Map<BucketId, AeadKey>();
  const versionedStore = new Map<string, AeadKey>();
  const maxSize = options?.maxSize;
  const versionedMaxSize =
    maxSize !== undefined ? maxSize * VERSIONED_BUDGET_MULTIPLIER : undefined;

  function versionKey(bucketId: BucketId, keyVersion: number): string {
    return `${bucketId}:v${String(keyVersion)}`;
  }

  return {
    get(bucketId: BucketId): AeadKey | undefined {
      const value = store.get(bucketId);
      if (value !== undefined && maxSize !== undefined) {
        // LRU promotion: delete and re-insert to move to end
        store.delete(bucketId);
        store.set(bucketId, value);
      }
      return value;
    },

    set(bucketId: BucketId, key: AeadKey): void {
      const existing = store.get(bucketId);
      if (existing !== undefined) {
        getSodium().memzero(existing);
        store.delete(bucketId);
      } else if (maxSize !== undefined && store.size >= maxSize) {
        evictOldest(store);
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
      for (const key of versionedStore.values()) {
        adapter.memzero(key);
      }
      versionedStore.clear();
    },

    get size(): number {
      return store.size;
    },

    getByVersion(bucketId: BucketId, keyVersion: number): AeadKey | undefined {
      const vk = versionKey(bucketId, keyVersion);
      const value = versionedStore.get(vk);
      if (value !== undefined && versionedMaxSize !== undefined) {
        // LRU promotion
        versionedStore.delete(vk);
        versionedStore.set(vk, value);
      }
      return value;
    },

    setVersioned(bucketId: BucketId, keyVersion: number, key: AeadKey): void {
      const vk = versionKey(bucketId, keyVersion);
      const existing = versionedStore.get(vk);
      if (existing !== undefined) {
        getSodium().memzero(existing);
        versionedStore.delete(vk);
      } else if (versionedMaxSize !== undefined && versionedStore.size >= versionedMaxSize) {
        evictOldest(versionedStore);
      }
      versionedStore.set(vk, key);
    },

    deleteVersion(bucketId: BucketId, keyVersion: number): void {
      const vk = versionKey(bucketId, keyVersion);
      const existing = versionedStore.get(vk);
      if (existing !== undefined) {
        getSodium().memzero(existing);
        versionedStore.delete(vk);
      }
    },
  };
}
