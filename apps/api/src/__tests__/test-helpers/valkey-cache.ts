import { ValkeyCache, type ValkeyCacheClient } from "../../lib/valkey-cache.js";

/**
 * Build a `ValkeyCache` backed by an in-memory `Map`.
 *
 * Intended for tests that need to exercise the real `ValkeyCache` code path
 * (namespace prefixing, JSON round-tripping, delete-on-parse-failure) without
 * a live Redis/Valkey. Constructing the real class (as opposed to mocking it
 * with `as unknown as ValkeyCache`) keeps `instanceof` checks and future
 * internal changes honest.
 *
 * The returned `store` is the raw backing `Map<string, string>` keyed on the
 * already-prefixed form (`"{namespace}:{key}"`). Tests that need to assert on
 * raw cache state (e.g. "was a corrupt entry evicted?") should destructure it
 * from the result; tests that only need the cache can take `{ cache }`.
 */
export function createInMemoryValkeyCache(namespace = "test"): {
  readonly cache: ValkeyCache;
  readonly store: Map<string, string>;
} {
  const store = new Map<string, string>();
  const client: ValkeyCacheClient = {
    get(key) {
      return Promise.resolve(store.get(key) ?? null);
    },
    set(key, value) {
      store.set(key, value);
      return Promise.resolve("OK" as const);
    },
    del(key) {
      return Promise.resolve(store.delete(key) ? 1 : 0);
    },
  };
  return { cache: new ValkeyCache(client, namespace), store };
}
