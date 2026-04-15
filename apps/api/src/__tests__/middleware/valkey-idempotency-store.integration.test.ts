import { ensureValkey } from "@pluralscape/queue/testing";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { ValkeyIdempotencyStore } from "../../middleware/stores/valkey-idempotency-store.js";

import type { CachedResponse } from "../../middleware/idempotency-store.js";
import type { ValkeyTestContext } from "@pluralscape/queue/testing";

describe("ValkeyIdempotencyStore (integration)", () => {
  let store: ValkeyIdempotencyStore | undefined;
  let valkey: ValkeyTestContext;

  function getStore(): ValkeyIdempotencyStore {
    if (!store) throw new Error("store not initialised — beforeAll may have failed");
    return store;
  }

  beforeAll(async () => {
    valkey = await ensureValkey();
    if (!valkey.available) return;

    const port = Number(process.env["TEST_VALKEY_PORT"]) || 10_944;
    const url = process.env["VALKEY_URL"] ?? `redis://localhost:${String(port)}`;
    store = await ValkeyIdempotencyStore.create(url);
  });

  afterAll(async () => {
    if (store) await store.disconnect();
    await valkey.cleanup();
  });

  it("returns null for unknown key", async () => {
    const result = await getStore().get("test-account", `idem-${crypto.randomUUID()}`);
    expect(result).toBeNull();
  });

  it("stores and retrieves a cached response", async () => {
    const key = `idem-${crypto.randomUUID()}`;
    const cached: CachedResponse = { statusCode: 201, body: '{"data":{"id":"x"}}' };
    await getStore().set("test-account", key, cached);
    const result = await getStore().get("test-account", key);
    expect(result).toEqual(cached);
  });

  it("scopes keys by account", async () => {
    const key = `idem-${crypto.randomUUID()}`;
    const cached: CachedResponse = { statusCode: 201, body: '{"data":{"id":"x"}}' };
    await getStore().set("account-a", key, cached);
    const result = await getStore().get("account-b", key);
    expect(result).toBeNull();
  });

  it("returns null and deletes corrupt cache entry failing Zod validation", async () => {
    const redis = valkey.redis;
    if (!redis) throw new Error("redis not available");

    const key = `idem-${crypto.randomUUID()}`;
    const corruptJson = JSON.stringify({ statusCode: "not-a-number", body: "ok" });
    const account = "test-account";
    const cacheKey = `ps:idem:${account}:${key}`;

    await redis.set(cacheKey, corruptJson);

    const result = await getStore().get(account, key);
    expect(result).toBeNull();

    const remaining = await redis.get(cacheKey);
    expect(remaining).toBeNull();
  });

  it("acquires and releases locks", async () => {
    const key = `idem-${crypto.randomUUID()}`;
    expect(await getStore().acquireLock("test-account", key)).toBe(true);
    expect(await getStore().acquireLock("test-account", key)).toBe(false);
    await getStore().releaseLock("test-account", key);
    expect(await getStore().acquireLock("test-account", key)).toBe(true);
  });
});
