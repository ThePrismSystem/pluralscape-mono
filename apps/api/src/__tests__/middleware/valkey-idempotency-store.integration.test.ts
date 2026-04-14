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

  it("returns null and deletes corrupt cache entry failing Zod validation", async () => {
    const key = `idem-${crypto.randomUUID()}`;
    // Write valid JSON that fails CachedResponseSchema (statusCode must be a number)
    const corruptJson = JSON.stringify({ statusCode: "not-a-number", body: "ok" });
    // Access the underlying Valkey client to inject corrupt data directly.
    // The store prefixes keys with "ps:idem:{accountId}:{key}".
    const account = "test-account";
    const cacheKey = `ps:idem:${account}:${key}`;

    // Use a second ioredis client to write the corrupt entry
    const port = Number(process.env["TEST_VALKEY_PORT"]) || 10_944;
    const url = process.env["VALKEY_URL"] ?? `redis://localhost:${String(port)}`;
    const moduleName = "ioredis";
    const mod = (await import(moduleName)) as {
      default: new (url: string) => {
        set(key: string, value: string): Promise<unknown>;
        get(key: string): Promise<string | null>;
        disconnect(): Promise<void>;
      };
    };
    const rawClient = new mod.default(url);
    await rawClient.set(cacheKey, corruptJson);

    // .get() should return null after Zod parse failure and delete the key
    const result = await store.get(account, key);
    expect(result).toBeNull();

    // Verify the corrupt key was deleted
    const remaining = await rawClient.get(cacheKey);
    expect(remaining).toBeNull();

    await rawClient.disconnect();
  });

  it("acquires and releases locks", async () => {
    const key = `idem-${crypto.randomUUID()}`;
    expect(await store.acquireLock("test-account", key)).toBe(true);
    expect(await store.acquireLock("test-account", key)).toBe(false);
    await store.releaseLock("test-account", key);
    expect(await store.acquireLock("test-account", key)).toBe(true);
  });
});
