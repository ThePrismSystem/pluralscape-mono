import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

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
