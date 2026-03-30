import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { ValkeyIdempotencyStore } from "../../middleware/stores/valkey-idempotency-store.js";

import type { CachedResponse } from "../../middleware/idempotency-store.js";

describe("ValkeyIdempotencyStore (integration)", () => {
  let store: ValkeyIdempotencyStore;

  beforeAll(async () => {
    const port = Number(process.env["TEST_VALKEY_PORT"]) || 10_944;
    const url = process.env["VALKEY_URL"] ?? `redis://localhost:${String(port)}`;
    store = await ValkeyIdempotencyStore.create(url);
  });

  afterAll(async () => {
    await store.disconnect();
  });

  it("returns null for unknown key", async () => {
    const result = await store.get("test-account", `idem-${crypto.randomUUID()}`);
    expect(result).toBeNull();
  });

  it("stores and retrieves a cached response", async () => {
    const key = `idem-${crypto.randomUUID()}`;
    const cached: CachedResponse = { statusCode: 201, body: '{"data":{"id":"x"}}' };
    await store.set("test-account", key, cached);
    const result = await store.get("test-account", key);
    expect(result).toEqual(cached);
  });

  it("scopes keys by account", async () => {
    const key = `idem-${crypto.randomUUID()}`;
    const cached: CachedResponse = { statusCode: 201, body: '{"data":{"id":"x"}}' };
    await store.set("account-a", key, cached);
    const result = await store.get("account-b", key);
    expect(result).toBeNull();
  });

  it("acquires and releases locks", async () => {
    const key = `idem-${crypto.randomUUID()}`;
    expect(await store.acquireLock("test-account", key)).toBe(true);
    expect(await store.acquireLock("test-account", key)).toBe(false);
    await store.releaseLock("test-account", key);
    expect(await store.acquireLock("test-account", key)).toBe(true);
  });
});
