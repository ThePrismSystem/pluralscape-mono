import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AsyncStorageI18nCache,
  type AsyncStorageLike,
  type CacheEntry,
} from "../async-storage-cache.js";

interface MockStorage extends AsyncStorageLike {
  readonly store: Map<string, string>;
}

function mockStorage(): MockStorage {
  const store = new Map<string, string>();
  return {
    store,
    getItem: vi.fn((k: string): Promise<string | null> => Promise.resolve(store.get(k) ?? null)),
    setItem: vi.fn((k: string, v: string): Promise<void> => {
      store.set(k, v);
      return Promise.resolve();
    }),
    removeItem: vi.fn((k: string): Promise<void> => {
      store.delete(k);
      return Promise.resolve();
    }),
  };
}

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const DAYS_PER_WEEK = 7;
const STALE_DAYS = 30;

const ONE_WEEK_MS =
  DAYS_PER_WEEK * HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MS_PER_SECOND;
const STALE_AGE_MS =
  STALE_DAYS * HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MS_PER_SECOND;
const ONE_SECOND_MS = MS_PER_SECOND;

describe("AsyncStorageI18nCache", () => {
  let storage: MockStorage;
  let cache: AsyncStorageI18nCache;

  beforeEach(() => {
    storage = mockStorage();
    cache = new AsyncStorageI18nCache(storage, ONE_WEEK_MS);
  });

  it("read returns null on miss", async () => {
    expect(await cache.read("en", "common")).toBeNull();
  });

  it("write/read round-trips entry", async () => {
    const entry: CacheEntry = {
      etag: "abc123",
      translations: { hello: "hola" },
      fetchedAt: Date.now(),
    };
    await cache.write("es", "common", entry);
    expect(await cache.read("es", "common")).toEqual(entry);
  });

  it("read returns stale entry past TTL (caller decides freshness)", async () => {
    const entry: CacheEntry = {
      etag: "abc123",
      translations: { hello: "hola" },
      fetchedAt: Date.now() - STALE_AGE_MS,
    };
    await cache.write("es", "common", entry);
    const read = await cache.read("es", "common");
    expect(read).toEqual(entry);
    expect(read === null ? true : cache.isFresh(read)).toBe(false);
  });

  it("isFresh true within TTL", () => {
    expect(
      cache.isFresh({
        etag: "e",
        translations: {},
        fetchedAt: Date.now() - ONE_SECOND_MS,
      }),
    ).toBe(true);
  });

  it("read warns and evicts corrupt entries on malformed payload", async () => {
    const warnSpy = vi.spyOn(globalThis.console, "warn").mockImplementation(() => undefined);
    await storage.setItem("@pluralscape:i18n:en:common", "not-json");
    expect(await cache.read("en", "common")).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      "i18n cache parse failed, evicting: en/common",
      expect.anything(),
    );
    expect(storage.store.has("@pluralscape:i18n:en:common")).toBe(false);
    warnSpy.mockRestore();
  });

  it("prefixes storage keys with @pluralscape:i18n namespace", async () => {
    const entry: CacheEntry = {
      etag: "e",
      translations: { a: "b" },
      fetchedAt: Date.now(),
    };
    await cache.write("fr", "auth", entry);
    expect([...storage.store.keys()]).toContain("@pluralscape:i18n:fr:auth");
  });
});
