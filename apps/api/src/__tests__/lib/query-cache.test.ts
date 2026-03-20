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

    expect(cache.size).toBe(0);
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
    expect(cache.size).toBe(2);
  });

  it("works with object values", () => {
    const cache = new QueryCache<{ id: string; name: string }>(60_000);
    const obj = { id: "1", name: "test" };
    cache.set("key", obj);
    expect(cache.get("key")).toEqual(obj);
  });
});
