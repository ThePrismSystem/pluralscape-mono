import { describe, it, expect } from "vitest";

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

  it("prefixes all keys with namespace", async () => {
    const client = mockClient();
    const cache = new ValkeyCache(client, "i18n");
    await cache.setJSON("manifest", { a: 1 }, 1000);
    expect([...client.store.keys()]).toEqual(["i18n:manifest"]);
  });
});
