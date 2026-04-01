import { beforeEach, describe, expect, it, vi } from "vitest";

// Backing store shared between mock and test — cleared in beforeEach
const backingStore = new Map<string, string>();

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn((key: string) => Promise.resolve(backingStore.get(key) ?? null)),
  setItemAsync: vi.fn((key: string, value: string) => {
    backingStore.set(key, value);
    return Promise.resolve();
  }),
  deleteItemAsync: vi.fn((key: string) => {
    backingStore.delete(key);
    return Promise.resolve();
  }),
}));

// Import AFTER mock setup
import { createExpoSecureTokenStore } from "../expo-secure-token-store.js";

beforeEach(() => {
  backingStore.clear();
  vi.clearAllMocks();
});

describe("createExpoSecureTokenStore", () => {
  it("getToken returns null when no token is stored", async () => {
    const store = createExpoSecureTokenStore();
    expect(await store.getToken()).toBeNull();
  });

  it("setToken stores and getToken retrieves the token", async () => {
    const store = createExpoSecureTokenStore();
    await store.setToken("my-session-token");
    expect(await store.getToken()).toBe("my-session-token");
  });

  it("clearToken removes the stored token", async () => {
    const store = createExpoSecureTokenStore();
    await store.setToken("my-session-token");
    await store.clearToken();
    expect(await store.getToken()).toBeNull();
  });

  it("setToken overwrites a previously stored token", async () => {
    const store = createExpoSecureTokenStore();
    await store.setToken("first");
    await store.setToken("second");
    expect(await store.getToken()).toBe("second");
  });
});
