import "fake-indexeddb/auto";

import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";

import { createIndexedDbTokenStore } from "../indexeddb-token-store.js";

describe("createIndexedDbTokenStore", () => {
  beforeEach(() => {
    // Replace the global indexedDB with a fresh instance for test isolation.
    globalThis.indexedDB = new IDBFactory();
  });

  it("returns null when no token stored", async () => {
    const store = createIndexedDbTokenStore();
    const result = await store.getToken();
    expect(result).toBeNull();
  });

  it("stores and retrieves a token", async () => {
    const store = createIndexedDbTokenStore();
    await store.setToken("test-token-abc");
    const result = await store.getToken();
    expect(result).toBe("test-token-abc");
  });

  it("clears a stored token", async () => {
    const store = createIndexedDbTokenStore();
    await store.setToken("token-to-clear");
    await store.clearToken();
    const result = await store.getToken();
    expect(result).toBeNull();
  });

  it("overwrites an existing token", async () => {
    const store = createIndexedDbTokenStore();
    await store.setToken("first-token");
    await store.setToken("second-token");
    const result = await store.getToken();
    expect(result).toBe("second-token");
  });
});
