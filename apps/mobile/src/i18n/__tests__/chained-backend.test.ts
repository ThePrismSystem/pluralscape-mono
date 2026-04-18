import { asEtag } from "@pluralscape/types";
import { describe, expect, it, vi } from "vitest";

import {
  type ChainedBackendCache,
  type ChainedBackendFetch,
  createChainedBackend,
} from "../chained-backend.js";

import type { CacheEntry } from "../async-storage-cache.js";

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const STALE_DAYS = 30;
const ONE_SECOND_MS = MS_PER_SECOND;
const STALE_AGE_MS =
  STALE_DAYS * HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MS_PER_SECOND;

interface MockCacheOverrides {
  readonly read?: ChainedBackendCache["read"];
  readonly write?: ChainedBackendCache["write"];
  readonly isFresh?: ChainedBackendCache["isFresh"];
}

function mockCache(overrides: MockCacheOverrides = {}): ChainedBackendCache {
  return {
    read: overrides.read ?? vi.fn((): Promise<CacheEntry | null> => Promise.resolve(null)),
    write: overrides.write ?? vi.fn((): Promise<void> => Promise.resolve()),
    isFresh: overrides.isFresh ?? ((): boolean => true),
  };
}

/**
 * The spec forbids constructing a Response with a null-body status (204/205/304),
 * so we subclass Response and override status to emit a 304 without hitting the
 * constructor's null-body check.
 */
class NotModifiedResponse extends Response {
  constructor() {
    super(null, { status: 200 });
  }
  override get status(): number {
    return 304;
  }
  override get ok(): boolean {
    return false;
  }
}

function notModifiedResponse(): Response {
  return new NotModifiedResponse();
}

function resolveOnce(
  backend: ReturnType<typeof createChainedBackend>,
  locale: string,
  namespace: string,
): Promise<Readonly<Record<string, string>>> {
  return new Promise((resolve, reject) => {
    backend.read(locale, namespace, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}

describe("createChainedBackend", () => {
  it("returns a single i18next backend plugin with type 'backend'", () => {
    const backend = createChainedBackend({
      apiBaseUrl: "https://api.test",
      loadBundled: () => Promise.resolve({ hello: "hi" }),
      cache: mockCache(),
      fetchImpl: vi.fn<ChainedBackendFetch>(),
    });
    expect(backend.type).toBe("backend");
  });

  it("serves bundled data when OTA fetch and cache both fail", async () => {
    const loadBundled = vi.fn(
      (): Promise<Readonly<Record<string, string>>> => Promise.resolve({ hello: "bundled" }),
    );
    const backend = createChainedBackend({
      apiBaseUrl: "https://api.test",
      loadBundled,
      cache: mockCache(),
      fetchImpl: vi.fn<ChainedBackendFetch>().mockRejectedValue(new Error("network down")),
    });
    const result = await resolveOnce(backend, "en", "common");
    expect(result).toEqual({ hello: "bundled" });
  });

  it("uses fresh cache without hitting network", async () => {
    const fetchImpl = vi.fn<ChainedBackendFetch>();
    const cache = mockCache({
      read: vi.fn(
        (): Promise<CacheEntry | null> =>
          Promise.resolve({
            etag: asEtag("e"),
            translations: { hello: "cached" },
            fetchedAt: Date.now() - ONE_SECOND_MS,
          }),
      ),
      isFresh: (): boolean => true,
    });
    const backend = createChainedBackend({
      apiBaseUrl: "https://api.test",
      loadBundled: () => Promise.resolve({ hello: "bundled" }),
      cache,
      fetchImpl,
    });
    const result = await resolveOnce(backend, "es", "common");
    expect(result).toEqual({ hello: "cached" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("writes OTA result to cache on 200", async () => {
    const cache = mockCache();
    const fetchImpl = vi.fn<ChainedBackendFetch>().mockResolvedValue(
      new Response(JSON.stringify({ data: { translations: { hello: "ola" } } }), {
        status: 200,
        headers: { etag: '"abc123"' },
      }),
    );
    const backend = createChainedBackend({
      apiBaseUrl: "https://api.test",
      loadBundled: () => Promise.resolve({ hello: "bundled" }),
      cache,
      fetchImpl,
    });
    const result = await resolveOnce(backend, "es", "common");
    expect(result).toEqual({ hello: "ola" });
    expect(cache.write).toHaveBeenCalled();
  });

  it("serves stale cache on 304", async () => {
    const cache = mockCache({
      read: vi.fn(
        (): Promise<CacheEntry | null> =>
          Promise.resolve({
            etag: asEtag("e"),
            translations: { hello: "stale" },
            fetchedAt: Date.now() - STALE_AGE_MS,
          }),
      ),
      isFresh: (): boolean => false,
    });
    const fetchImpl = vi.fn<ChainedBackendFetch>().mockResolvedValue(notModifiedResponse());
    const backend = createChainedBackend({
      apiBaseUrl: "https://api.test",
      loadBundled: () => Promise.resolve({ hello: "bundled" }),
      cache,
      fetchImpl,
    });
    const result = await resolveOnce(backend, "es", "common");
    expect(result).toEqual({ hello: "stale" });
  });

  it("sends If-None-Match header when cached etag exists", async () => {
    const cache = mockCache({
      read: vi.fn(
        (): Promise<CacheEntry | null> =>
          Promise.resolve({
            etag: asEtag("abc123"),
            translations: { hello: "stale" },
            fetchedAt: Date.now() - STALE_AGE_MS,
          }),
      ),
      isFresh: (): boolean => false,
    });
    const fetchImpl = vi.fn<ChainedBackendFetch>().mockResolvedValue(notModifiedResponse());
    const backend = createChainedBackend({
      apiBaseUrl: "https://api.test",
      loadBundled: () => Promise.resolve({ hello: "bundled" }),
      cache,
      fetchImpl,
    });
    await resolveOnce(backend, "es", "common");
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.test/v1/i18n/es/common",
      expect.objectContaining({
        headers: expect.objectContaining({ "if-none-match": '"abc123"' }),
      }),
    );
  });

  it("falls back to cache when network fails with stale entry", async () => {
    const cache = mockCache({
      read: vi.fn(
        (): Promise<CacheEntry | null> =>
          Promise.resolve({
            etag: asEtag("e"),
            translations: { hello: "stale-offline" },
            fetchedAt: Date.now() - STALE_AGE_MS,
          }),
      ),
      isFresh: (): boolean => false,
    });
    const backend = createChainedBackend({
      apiBaseUrl: "https://api.test",
      loadBundled: () => Promise.resolve({ hello: "bundled" }),
      cache,
      fetchImpl: vi.fn<ChainedBackendFetch>().mockRejectedValue(new Error("offline")),
    });
    const result = await resolveOnce(backend, "es", "common");
    expect(result).toEqual({ hello: "stale-offline" });
  });

  it("falls back to bundled on non-200 non-304 response with no cache", async () => {
    const fetchImpl = vi
      .fn<ChainedBackendFetch>()
      .mockResolvedValue(new Response("", { status: 500 }));
    const backend = createChainedBackend({
      apiBaseUrl: "https://api.test",
      loadBundled: () => Promise.resolve({ hello: "bundled" }),
      cache: mockCache(),
      fetchImpl,
    });
    const result = await resolveOnce(backend, "en", "common");
    expect(result).toEqual({ hello: "bundled" });
  });

  it("warns when OTA fetch fails but cached data exists", async () => {
    const warnSpy = vi.spyOn(globalThis.console, "warn").mockImplementation(() => undefined);
    const cache = mockCache({
      read: vi.fn(
        (): Promise<CacheEntry | null> =>
          Promise.resolve({
            etag: asEtag("e"),
            translations: { hello: "stale" },
            fetchedAt: Date.now() - STALE_AGE_MS,
          }),
      ),
      isFresh: (): boolean => false,
    });
    const backend = createChainedBackend({
      apiBaseUrl: "https://api.test",
      loadBundled: () => Promise.resolve({ hello: "bundled" }),
      cache,
      fetchImpl: vi.fn<ChainedBackendFetch>().mockRejectedValue(new Error("offline")),
    });
    const result = await resolveOnce(backend, "es", "common");
    expect(result).toEqual({ hello: "stale" });
    expect(warnSpy).toHaveBeenCalledWith(
      "i18n OTA fetch failed, falling back: es/common",
      expect.anything(),
    );
    warnSpy.mockRestore();
  });

  it("refreshes fetchedAt on 304 by writing a bumped entry", async () => {
    const originalFetchedAt = Date.now() - STALE_AGE_MS;
    const writeSpy = vi.fn<ChainedBackendCache["write"]>((): Promise<void> => Promise.resolve());
    const cache = mockCache({
      read: vi.fn(
        (): Promise<CacheEntry | null> =>
          Promise.resolve({
            etag: asEtag("e"),
            translations: { hello: "stale" },
            fetchedAt: originalFetchedAt,
          }),
      ),
      isFresh: (): boolean => false,
      write: writeSpy,
    });
    const fetchImpl = vi.fn<ChainedBackendFetch>().mockResolvedValue(notModifiedResponse());
    const backend = createChainedBackend({
      apiBaseUrl: "https://api.test",
      loadBundled: () => Promise.resolve({ hello: "bundled" }),
      cache,
      fetchImpl,
    });
    await resolveOnce(backend, "es", "common");
    expect(writeSpy).toHaveBeenCalledWith(
      "es",
      "common",
      expect.objectContaining({
        etag: asEtag("e"),
        translations: { hello: "stale" },
        fetchedAt: expect.any(Number),
      }),
    );
    const writtenEntry = writeSpy.mock.calls[0]?.[2];
    expect(writtenEntry?.fetchedAt).toBeGreaterThan(originalFetchedAt);
  });
});
