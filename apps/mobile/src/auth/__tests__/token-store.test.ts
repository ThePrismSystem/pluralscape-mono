import "fake-indexeddb/auto";

import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";

import { createTokenStore } from "../token-store.js";

describe("createTokenStore (web path, hasSecureStorage: false)", () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
  });

  it("returns null when no token stored", async () => {
    const store = await createTokenStore({ hasSecureStorage: false });
    const result = await store.getToken();
    expect(result).toBeNull();
  });

  it("stores and retrieves a token", async () => {
    const store = await createTokenStore({ hasSecureStorage: false });
    await store.setToken("web-token-123");
    const result = await store.getToken();
    expect(result).toBe("web-token-123");
  });

  it("clears a stored token", async () => {
    const store = await createTokenStore({ hasSecureStorage: false });
    await store.setToken("web-token-to-clear");
    await store.clearToken();
    const result = await store.getToken();
    expect(result).toBeNull();
  });

  it("overwrites an existing token", async () => {
    const store = await createTokenStore({ hasSecureStorage: false });
    await store.setToken("first");
    await store.setToken("second");
    const result = await store.getToken();
    expect(result).toBe("second");
  });
});
