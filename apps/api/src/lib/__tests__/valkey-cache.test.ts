import { describe, it, expect, vi } from "vitest";

import { logger } from "../logger.js";
import { ValkeyCache, type ValkeyCacheClient } from "../valkey-cache.js";

interface MockClient extends ValkeyCacheClient {
  readonly store: Map<string, { v: string; ex: number }>;
}

function mockClient(): MockClient {
  const store = new Map<string, { v: string; ex: number }>();
  return {
    store,
    get(key) {
      return Promise.resolve(store.get(key)?.v ?? null);
    },
    set(key, value, _mode, ttlMs) {
      store.set(key, { v: value, ex: ttlMs });
      return Promise.resolve("OK");
    },
    del(key) {
      return Promise.resolve(store.delete(key) ? 1 : 0);
    },
  };
}

describe("ValkeyCache", () => {
  it("getJSON returns null on miss", async () => {
    const cache = new ValkeyCache(mockClient(), "ns");
    expect(await cache.getJSON("k")).toBeNull();
  });

  it("setJSON round-trips with TTL", async () => {
    const client = mockClient();
    const cache = new ValkeyCache(client, "ns");
    await cache.setJSON("k", { a: 1 }, 1000);
    expect(await cache.getJSON("k")).toEqual({ a: 1 });
    expect(client.store.get("ns:k")?.ex).toBe(1000);
  });

  it("delete removes the key", async () => {
    const cache = new ValkeyCache(mockClient(), "ns");
    await cache.setJSON("k", 1, 1000);
    await cache.delete("k");
    expect(await cache.getJSON("k")).toBeNull();
  });

  it("returns null when payload fails to parse", async () => {
    const client = mockClient();
    client.store.set("ns:bad", { v: "not-json", ex: 1000 });
    const cache = new ValkeyCache(client, "ns");
    expect(await cache.getJSON("bad")).toBeNull();
  });

  it("deletes the corrupt entry on JSON parse failure", async () => {
    const client = mockClient();
    client.store.set("ns:bad", { v: "{not valid json", ex: 1000 });
    const cache = new ValkeyCache(client, "ns");
    const result = await cache.getJSON("bad");
    expect(result).toBeNull();
    // The prefixed key must be evicted so later reads don't re-hit the
    // corrupt payload and re-parse it.
    expect(client.store.has("ns:bad")).toBe(false);
  });

  it("prefixes all keys with namespace", async () => {
    const client = mockClient();
    const cache = new ValkeyCache(client, "i18n");
    await cache.setJSON("manifest", { a: 1 }, 1000);
    expect([...client.store.keys()]).toEqual(["i18n:manifest"]);
  });

  // `setJSON` is the raw write path — callers (typically handlers that CANNOT
  // tolerate a silent cache loss) must see the propagated error. The
  // swallowing `trySetJSON` variant is tested separately below.
  it("propagates client.set errors from setJSON", async () => {
    const client: ValkeyCacheClient = {
      get: () => Promise.resolve(null),
      set: () => Promise.reject(new Error("connection lost")),
      del: () => Promise.resolve(0),
    };
    const cache = new ValkeyCache(client, "test");
    await expect(cache.setJSON("key", { hello: "world" }, 1000)).rejects.toThrow("connection lost");
  });

  describe("trySetJSON", () => {
    it("writes JSON when the underlying client succeeds", async () => {
      const client = mockClient();
      const cache = new ValkeyCache(client, "ns");
      await cache.trySetJSON("k", { a: 1 }, 1000);
      expect(await cache.getJSON("k")).toEqual({ a: 1 });
    });

    it("logs and swallows Error failures so callers never see the throw", async () => {
      const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
      const failing: ValkeyCacheClient = {
        get: () => Promise.resolve(null),
        set: () => Promise.reject(new Error("connection lost")),
        del: () => Promise.resolve(0),
      };
      const cache = new ValkeyCache(failing, "i18n");
      await expect(cache.trySetJSON("k", { a: 1 }, 1000)).resolves.toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith(
        "valkey-cache: setJSON failed, continuing",
        expect.objectContaining({
          // Key MUST be namespace-prefixed — that's strictly more informative
          // than the route-level key alone.
          key: "i18n:k",
          error: "connection lost",
        }),
      );
      warnSpy.mockRestore();
    });
  });
});
