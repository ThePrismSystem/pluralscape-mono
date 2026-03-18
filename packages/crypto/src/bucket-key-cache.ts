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

/** Create a new in-memory bucket key cache backed by a Map. */
export function createBucketKeyCache(): BucketKeyCache {
  const store = new Map<BucketId, AeadKey>();
  const versionedStore = new Map<string, AeadKey>();

  function versionKey(bucketId: BucketId, keyVersion: number): string {
    return `${bucketId}:v${String(keyVersion)}`;
  }

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
      for (const key of versionedStore.values()) {
        adapter.memzero(key);
      }
      versionedStore.clear();
    },

    get size(): number {
      return store.size;
    },

    getByVersion(bucketId: BucketId, keyVersion: number): AeadKey | undefined {
      return versionedStore.get(versionKey(bucketId, keyVersion));
    },

    setVersioned(bucketId: BucketId, keyVersion: number, key: AeadKey): void {
      const vk = versionKey(bucketId, keyVersion);
      const existing = versionedStore.get(vk);
      if (existing !== undefined) {
        getSodium().memzero(existing);
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
