import { describe, it, expect, beforeEach } from "vitest";

import { MemoryIdempotencyStore } from "../../middleware/stores/memory-idempotency-store.js";

import type { CachedResponse } from "../../middleware/idempotency-store.js";

describe("MemoryIdempotencyStore", () => {
  let store: MemoryIdempotencyStore;

  beforeEach(() => {
    store = new MemoryIdempotencyStore();
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
});
