import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createBucketKeyCache } from "../bucket-key-cache.js";
import { generateBucketKey } from "../bucket-keys.js";
import { getSodium } from "../sodium.js";

import { setupSodium, teardownSodium } from "./helpers/setup-sodium.js";

import type { BucketKeyCache } from "../bucket-key-cache.js";
import type { AeadKey } from "../types.js";
import type { BucketId } from "@pluralscape/types";

const bucket1 = "bucket-001" as BucketId;
const bucket2 = "bucket-002" as BucketId;
const bucket3 = "bucket-003" as BucketId;
const bucket4 = "bucket-004" as BucketId;

let cache: BucketKeyCache;

beforeAll(setupSodium);
afterAll(teardownSodium);

beforeEach(() => {
  cache = createBucketKeyCache();
});

describe("basic operations", () => {
  it("get returns undefined for unknown bucketId", () => {
    expect(cache.get(bucket1)).toBeUndefined();
  });

  it("has returns false for unknown bucketId", () => {
    expect(cache.has(bucket1)).toBe(false);
  });

  it("set and get roundtrip", () => {
    const key = generateBucketKey();
    cache.set(bucket1, key);
    expect(cache.get(bucket1)).toBe(key);
  });

  it("has returns true after set", () => {
    cache.set(bucket1, generateBucketKey());
    expect(cache.has(bucket1)).toBe(true);
  });

  it("size reflects number of cached keys", () => {
    expect(cache.size).toBe(0);
    cache.set(bucket1, generateBucketKey());
    expect(cache.size).toBe(1);
    cache.set(bucket2, generateBucketKey());
    expect(cache.size).toBe(2);
  });

  it("delete removes the key", () => {
    cache.set(bucket1, generateBucketKey());
    cache.delete(bucket1);
    expect(cache.has(bucket1)).toBe(false);
    expect(cache.get(bucket1)).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it("delete is a no-op for unknown bucketId", () => {
    expect(() => {
      cache.delete(bucket1);
    }).not.toThrow();
    expect(cache.size).toBe(0);
  });

  it("clearAll empties the cache", () => {
    cache.set(bucket1, generateBucketKey());
    cache.set(bucket2, generateBucketKey());
    cache.clearAll();
    expect(cache.size).toBe(0);
    expect(cache.has(bucket1)).toBe(false);
    expect(cache.has(bucket2)).toBe(false);
  });
});

describe("memory safety: memzero on removal", () => {
  it("delete memzeros the removed key", () => {
    const key = generateBucketKey();
    cache.set(bucket1, key);
    const sodium = getSodium();
    const memzeroSpy = vi.spyOn(sodium, "memzero");
    cache.delete(bucket1);
    expect(memzeroSpy).toHaveBeenCalledWith(key);
    memzeroSpy.mockRestore();
  });

  it("clearAll memzeros all stored keys", () => {
    const key1 = generateBucketKey();
    const key2 = generateBucketKey();
    const key3 = generateBucketKey();
    cache.set(bucket1, key1);
    cache.set(bucket2, key2);
    cache.set(bucket3, key3);

    const sodium = getSodium();
    const memzeroSpy = vi.spyOn(sodium, "memzero");
    cache.clearAll();
    expect(memzeroSpy).toHaveBeenCalledTimes(3);
    expect(memzeroSpy).toHaveBeenCalledWith(key1);
    expect(memzeroSpy).toHaveBeenCalledWith(key2);
    expect(memzeroSpy).toHaveBeenCalledWith(key3);
    memzeroSpy.mockRestore();
  });

  it("set memzeros old key when replacing an existing bucketId", () => {
    const oldKey = generateBucketKey();
    const newKey = generateBucketKey();
    cache.set(bucket1, oldKey);

    const sodium = getSodium();
    const memzeroSpy = vi.spyOn(sodium, "memzero");
    cache.set(bucket1, newKey);
    expect(memzeroSpy).toHaveBeenCalledWith(oldKey);
    expect(memzeroSpy).toHaveBeenCalledTimes(1);
    memzeroSpy.mockRestore();

    // New key is retrievable
    expect(cache.get(bucket1)).toBe(newKey);
  });

  it("set does not memzero when inserting a new bucketId", () => {
    const key = generateBucketKey();
    const sodium = getSodium();
    const memzeroSpy = vi.spyOn(sodium, "memzero");
    cache.set(bucket1, key);
    expect(memzeroSpy).not.toHaveBeenCalled();
    memzeroSpy.mockRestore();
  });

  it("delete does not call memzero for unknown bucketId", () => {
    const sodium = getSodium();
    const memzeroSpy = vi.spyOn(sodium, "memzero");
    cache.delete(bucket1);
    expect(memzeroSpy).not.toHaveBeenCalled();
    memzeroSpy.mockRestore();
  });

  it("clearAll on empty cache does not call memzero", () => {
    const sodium = getSodium();
    const memzeroSpy = vi.spyOn(sodium, "memzero");
    cache.clearAll();
    expect(memzeroSpy).not.toHaveBeenCalled();
    memzeroSpy.mockRestore();
  });
});

describe("isolation", () => {
  it("two caches are independent", () => {
    const cache2 = createBucketKeyCache();
    const key: AeadKey = generateBucketKey();
    cache.set(bucket1, key);
    expect(cache2.has(bucket1)).toBe(false);
  });
});

describe("versioned key operations", () => {
  it("getByVersion returns undefined for unknown bucket and version", () => {
    expect(cache.getByVersion(bucket1, 1)).toBeUndefined();
  });

  it("setVersioned and getByVersion roundtrip", () => {
    const key = generateBucketKey();
    cache.setVersioned(bucket1, 1, key);
    expect(cache.getByVersion(bucket1, 1)).toBe(key);
  });

  it("different versions for the same bucket are stored independently", () => {
    const key1 = generateBucketKey();
    const key2 = generateBucketKey();
    cache.setVersioned(bucket1, 1, key1);
    cache.setVersioned(bucket1, 2, key2);
    expect(cache.getByVersion(bucket1, 1)).toBe(key1);
    expect(cache.getByVersion(bucket1, 2)).toBe(key2);
  });

  it("same version for different buckets are stored independently", () => {
    const key1 = generateBucketKey();
    const key2 = generateBucketKey();
    cache.setVersioned(bucket1, 1, key1);
    cache.setVersioned(bucket2, 1, key2);
    expect(cache.getByVersion(bucket1, 1)).toBe(key1);
    expect(cache.getByVersion(bucket2, 1)).toBe(key2);
  });

  it("versioned keys do not affect the main store size", () => {
    cache.setVersioned(bucket1, 1, generateBucketKey());
    cache.setVersioned(bucket1, 2, generateBucketKey());
    expect(cache.size).toBe(0);
  });

  it("deleteVersion removes the versioned key", () => {
    const key = generateBucketKey();
    cache.setVersioned(bucket1, 1, key);
    cache.deleteVersion(bucket1, 1);
    expect(cache.getByVersion(bucket1, 1)).toBeUndefined();
  });

  it("deleteVersion is a no-op for an unknown version", () => {
    expect(() => {
      cache.deleteVersion(bucket1, 99);
    }).not.toThrow();
  });

  it("deleteVersion only removes the targeted version", () => {
    const key1 = generateBucketKey();
    const key2 = generateBucketKey();
    cache.setVersioned(bucket1, 1, key1);
    cache.setVersioned(bucket1, 2, key2);
    cache.deleteVersion(bucket1, 1);
    expect(cache.getByVersion(bucket1, 1)).toBeUndefined();
    expect(cache.getByVersion(bucket1, 2)).toBe(key2);
  });
});

describe("memory safety: memzero on versioned removal", () => {
  it("deleteVersion memzeros the removed key", () => {
    const key = generateBucketKey();
    cache.setVersioned(bucket1, 1, key);
    const sodium = getSodium();
    const memzeroSpy = vi.spyOn(sodium, "memzero");
    cache.deleteVersion(bucket1, 1);
    expect(memzeroSpy).toHaveBeenCalledWith(key);
    memzeroSpy.mockRestore();
  });

  it("deleteVersion does not call memzero for unknown version", () => {
    const sodium = getSodium();
    const memzeroSpy = vi.spyOn(sodium, "memzero");
    cache.deleteVersion(bucket1, 99);
    expect(memzeroSpy).not.toHaveBeenCalled();
    memzeroSpy.mockRestore();
  });

  it("setVersioned memzeros old key when replacing an existing version", () => {
    const oldKey = generateBucketKey();
    const newKey = generateBucketKey();
    cache.setVersioned(bucket1, 1, oldKey);
    const sodium = getSodium();
    const memzeroSpy = vi.spyOn(sodium, "memzero");
    cache.setVersioned(bucket1, 1, newKey);
    expect(memzeroSpy).toHaveBeenCalledWith(oldKey);
    expect(memzeroSpy).toHaveBeenCalledTimes(1);
    memzeroSpy.mockRestore();
    expect(cache.getByVersion(bucket1, 1)).toBe(newKey);
  });

  it("setVersioned does not memzero when inserting a new version", () => {
    const key = generateBucketKey();
    const sodium = getSodium();
    const memzeroSpy = vi.spyOn(sodium, "memzero");
    cache.setVersioned(bucket1, 1, key);
    expect(memzeroSpy).not.toHaveBeenCalled();
    memzeroSpy.mockRestore();
  });

  it("clearAll memzeros versioned keys in addition to main keys", () => {
    const mainKey = generateBucketKey();
    const vKey1 = generateBucketKey();
    const vKey2 = generateBucketKey();
    cache.set(bucket1, mainKey);
    cache.setVersioned(bucket1, 1, vKey1);
    cache.setVersioned(bucket2, 1, vKey2);
    const sodium = getSodium();
    const memzeroSpy = vi.spyOn(sodium, "memzero");
    cache.clearAll();
    expect(memzeroSpy).toHaveBeenCalledTimes(3);
    expect(memzeroSpy).toHaveBeenCalledWith(mainKey);
    expect(memzeroSpy).toHaveBeenCalledWith(vKey1);
    expect(memzeroSpy).toHaveBeenCalledWith(vKey2);
    memzeroSpy.mockRestore();
  });

  it("clearAll removes all versioned keys", () => {
    cache.setVersioned(bucket1, 1, generateBucketKey());
    cache.setVersioned(bucket1, 2, generateBucketKey());
    cache.clearAll();
    expect(cache.getByVersion(bucket1, 1)).toBeUndefined();
    expect(cache.getByVersion(bucket1, 2)).toBeUndefined();
  });

  it("clearAll on cache with only versioned keys does not throw", () => {
    cache.setVersioned(bucket1, 1, generateBucketKey());
    expect(() => {
      cache.clearAll();
    }).not.toThrow();
    expect(cache.size).toBe(0);
  });
});

describe("same-reference safety", () => {
  it("set() with same Uint8Array instance promotes without memzero", () => {
    const key = generateBucketKey();
    cache.set(bucket1, key);
    const sodium = getSodium();
    const memzeroSpy = vi.spyOn(sodium, "memzero");
    cache.set(bucket1, key);
    expect(memzeroSpy).not.toHaveBeenCalled();
    memzeroSpy.mockRestore();
    expect(cache.get(bucket1)).toBe(key);
  });

  it("setVersioned() with same Uint8Array instance promotes without memzero", () => {
    const key = generateBucketKey();
    cache.setVersioned(bucket1, 1, key);
    const sodium = getSodium();
    const memzeroSpy = vi.spyOn(sodium, "memzero");
    cache.setVersioned(bucket1, 1, key);
    expect(memzeroSpy).not.toHaveBeenCalled();
    memzeroSpy.mockRestore();
    expect(cache.getByVersion(bucket1, 1)).toBe(key);
  });
});

describe("LRU eviction (maxSize)", () => {
  let lruCache: BucketKeyCache;

  beforeEach(() => {
    lruCache = createBucketKeyCache({ maxSize: 3 });
  });

  afterEach(() => {
    lruCache.clearAll();
  });

  it("evicts oldest entry when exceeding maxSize", () => {
    lruCache.set(bucket1, generateBucketKey());
    lruCache.set(bucket2, generateBucketKey());
    lruCache.set(bucket3, generateBucketKey());
    lruCache.set(bucket4, generateBucketKey());
    expect(lruCache.size).toBe(3);
    expect(lruCache.has(bucket1)).toBe(false);
    expect(lruCache.has(bucket2)).toBe(true);
    expect(lruCache.has(bucket3)).toBe(true);
    expect(lruCache.has(bucket4)).toBe(true);
  });

  it("get() promotes key so it is not evicted", () => {
    lruCache.set(bucket1, generateBucketKey());
    lruCache.set(bucket2, generateBucketKey());
    lruCache.set(bucket3, generateBucketKey());
    // Access bucket1 to promote it
    lruCache.get(bucket1);
    // Insert bucket4 — should evict bucket2 (oldest not-promoted)
    lruCache.set(bucket4, generateBucketKey());
    expect(lruCache.has(bucket1)).toBe(true);
    expect(lruCache.has(bucket2)).toBe(false);
    expect(lruCache.has(bucket3)).toBe(true);
    expect(lruCache.has(bucket4)).toBe(true);
  });

  it("memzeros evicted keys", () => {
    const key1 = generateBucketKey();
    lruCache.set(bucket1, key1);
    lruCache.set(bucket2, generateBucketKey());
    lruCache.set(bucket3, generateBucketKey());
    const sodium = getSodium();
    const memzeroSpy = vi.spyOn(sodium, "memzero");
    lruCache.set(bucket4, generateBucketKey());
    expect(memzeroSpy).toHaveBeenCalledWith(key1);
    memzeroSpy.mockRestore();
  });

  it("without maxSize, cache is unbounded", () => {
    const unbounded = createBucketKeyCache();
    for (let i = 0; i < 100; i++) {
      unbounded.set(`bucket-${String(i).padStart(3, "0")}` as BucketId, generateBucketKey());
    }
    expect(unbounded.size).toBe(100);
    unbounded.clearAll();
  });

  it("versioned store uses separate LRU budget", () => {
    // maxSize 3 for main store, versioned gets maxSize * 2 = 6
    for (let v = 1; v <= 7; v++) {
      lruCache.setVersioned(bucket1, v, generateBucketKey());
    }
    // First versioned entry should be evicted
    expect(lruCache.getByVersion(bucket1, 1)).toBeUndefined();
    // Later entries should remain
    expect(lruCache.getByVersion(bucket1, 7)).toBeDefined();
  });
});
