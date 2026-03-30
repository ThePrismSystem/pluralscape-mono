import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  IDEMPOTENCY_CACHE_TTL_SEC,
  IDEMPOTENCY_LOCK_TTL_SEC,
} from "../../middleware/idempotency.constants.js";
import { MemoryIdempotencyStore } from "../../middleware/stores/memory-idempotency-store.js";

import type { CachedResponse } from "../../middleware/idempotency-store.js";

const MS_PER_SEC = 1_000;

describe("MemoryIdempotencyStore", () => {
  let store: MemoryIdempotencyStore;

  beforeEach(() => {
    store = new MemoryIdempotencyStore();
  });

  afterEach(async () => {
    await store.disconnect();
  });

  it("returns null for unknown key", async () => {
    const result = await store.get("account-1", "key-1");
    expect(result).toBeNull();
  });

  it("stores and retrieves a cached response", async () => {
    const cached: CachedResponse = { statusCode: 201, body: '{"data":{"id":"123"}}' };
    await store.set("account-1", "key-1", cached);
    const result = await store.get("account-1", "key-1");
    expect(result).toEqual(cached);
  });

  it("scopes keys by account", async () => {
    const cached: CachedResponse = { statusCode: 201, body: '{"data":{"id":"123"}}' };
    await store.set("account-1", "key-1", cached);
    const result = await store.get("account-2", "key-1");
    expect(result).toBeNull();
  });

  it("acquires lock for new key", async () => {
    const acquired = await store.acquireLock("account-1", "key-1");
    expect(acquired).toBe(true);
  });

  it("fails to acquire lock when already held", async () => {
    await store.acquireLock("account-1", "key-1");
    const acquired = await store.acquireLock("account-1", "key-1");
    expect(acquired).toBe(false);
  });

  it("releases lock allowing re-acquisition", async () => {
    await store.acquireLock("account-1", "key-1");
    await store.releaseLock("account-1", "key-1");
    const acquired = await store.acquireLock("account-1", "key-1");
    expect(acquired).toBe(true);
  });

  describe("TTL expiry", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("returns null for expired cache entry", async () => {
      const cached: CachedResponse = { statusCode: 200, body: '{"data":"ok"}' };
      await store.set("account-1", "ttl-key", cached);

      // Still valid just before expiry
      vi.advanceTimersByTime(IDEMPOTENCY_CACHE_TTL_SEC * MS_PER_SEC - 1);
      expect(await store.get("account-1", "ttl-key")).toEqual(cached);

      // Expired after TTL
      vi.advanceTimersByTime(2);
      expect(await store.get("account-1", "ttl-key")).toBeNull();
    });

    it("lazily evicts expired entry from cache on get", async () => {
      const cached: CachedResponse = { statusCode: 200, body: '{"data":"old"}' };
      await store.set("account-1", "evict-key", cached);

      vi.advanceTimersByTime(IDEMPOTENCY_CACHE_TTL_SEC * MS_PER_SEC + 1);

      // get() returns null and evicts
      expect(await store.get("account-1", "evict-key")).toBeNull();

      // Set a new value and confirm old data is gone
      const fresh: CachedResponse = { statusCode: 201, body: '{"data":"new"}' };
      await store.set("account-1", "evict-key", fresh);
      expect(await store.get("account-1", "evict-key")).toEqual(fresh);
    });

    it("allows re-acquisition of expired lock", async () => {
      await store.acquireLock("account-1", "lock-key");

      // Lock still held just before expiry
      vi.advanceTimersByTime(IDEMPOTENCY_LOCK_TTL_SEC * MS_PER_SEC - 1);
      expect(await store.acquireLock("account-1", "lock-key")).toBe(false);

      // Lock expired — re-acquisition succeeds
      vi.advanceTimersByTime(2);
      expect(await store.acquireLock("account-1", "lock-key")).toBe(true);
    });
  });
});
