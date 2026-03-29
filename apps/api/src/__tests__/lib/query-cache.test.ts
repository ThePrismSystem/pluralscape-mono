import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { QueryCache } from "../../lib/query-cache.js";

describe("QueryCache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns undefined for missing keys", () => {
    const cache = new QueryCache<string>(1000);
    expect(cache.get("missing")).toBeUndefined();
  });

  it("stores and retrieves values", () => {
    const cache = new QueryCache<string>(1000);
    cache.set("key", "value");
    expect(cache.get("key")).toBe("value");
  });

  it("evicts expired entries on access", () => {
    const cache = new QueryCache<string>(1000);
    cache.set("key", "value");

    vi.advanceTimersByTime(1001);

    expect(cache.get("key")).toBeUndefined();
  });

  it("returns value within TTL window", () => {
    const cache = new QueryCache<string>(1000);
    cache.set("key", "value");

    vi.advanceTimersByTime(999);

    expect(cache.get("key")).toBe("value");
  });

  it("invalidates a specific key", () => {
    const cache = new QueryCache<string>(60_000);
    cache.set("a", "1");
    cache.set("b", "2");

    cache.invalidate("a");

    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe("2");
  });

  it("clears all entries", () => {
    const cache = new QueryCache<string>(60_000);
    cache.set("a", "1");
    cache.set("b", "2");

    cache.clear();

    expect(cache.approximateSize).toBe(0);
    expect(cache.get("a")).toBeUndefined();
  });

  it("overwrites existing entries with new TTL", () => {
    const cache = new QueryCache<string>(1000);
    cache.set("key", "old");

    vi.advanceTimersByTime(800);
    cache.set("key", "new");

    vi.advanceTimersByTime(800);
    expect(cache.get("key")).toBe("new");
  });

  it("reports size including possibly-expired entries", () => {
    const cache = new QueryCache<string>(1000);
    cache.set("a", "1");
    cache.set("b", "2");
    expect(cache.approximateSize).toBe(2);
  });

  it("works with object values", () => {
    const cache = new QueryCache<{ id: string; name: string }>(60_000);
    const obj = { id: "1", name: "test" };
    cache.set("key", obj);
    expect(cache.get("key")).toEqual(obj);
  });

  describe("maxSize bounded eviction", () => {
    const SMALL_MAX_SIZE = 3;
    const LONG_TTL_MS = 60_000;
    const SHORT_TTL_MS = 100;

    it("accepts a custom maxSize", () => {
      const cache = new QueryCache<string>(LONG_TTL_MS, SMALL_MAX_SIZE);
      for (let i = 0; i < SMALL_MAX_SIZE; i++) {
        cache.set(`k${String(i)}`, `v${String(i)}`);
      }
      expect(cache.approximateSize).toBe(SMALL_MAX_SIZE);
    });

    it("evicts the oldest entry when at capacity", () => {
      const cache = new QueryCache<string>(LONG_TTL_MS, SMALL_MAX_SIZE);

      cache.set("a", "1");
      cache.set("b", "2");
      cache.set("c", "3");

      // At capacity — inserting "d" should evict "a" (oldest)
      cache.set("d", "4");

      expect(cache.approximateSize).toBe(SMALL_MAX_SIZE);
      expect(cache.get("a")).toBeUndefined();
      expect(cache.get("b")).toBe("2");
      expect(cache.get("c")).toBe("3");
      expect(cache.get("d")).toBe("4");
    });

    it("sweeps expired entries before evicting by age", () => {
      const cache = new QueryCache<string>(SHORT_TTL_MS, SMALL_MAX_SIZE);

      cache.set("old1", "x");
      cache.set("old2", "y");
      cache.set("old3", "z");

      // Expire all existing entries
      vi.advanceTimersByTime(SHORT_TTL_MS + 1);

      // Insert a new entry — expired entries are swept, no FIFO eviction needed
      cache.set("fresh", "new");

      expect(cache.approximateSize).toBe(1);
      expect(cache.get("fresh")).toBe("new");
    });

    it("does not evict when updating an existing key", () => {
      const cache = new QueryCache<string>(LONG_TTL_MS, SMALL_MAX_SIZE);

      cache.set("a", "1");
      cache.set("b", "2");
      cache.set("c", "3");

      // Updating "a" should not trigger eviction even though size == maxSize
      cache.set("a", "updated");

      expect(cache.approximateSize).toBe(SMALL_MAX_SIZE);
      expect(cache.get("a")).toBe("updated");
      expect(cache.get("b")).toBe("2");
      expect(cache.get("c")).toBe("3");
    });
  });
});
