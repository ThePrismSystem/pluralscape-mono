import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    setItemAsync: vi.fn((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    }),
    deleteItemAsync: vi.fn((key: string) => {
      store.delete(key);
      return Promise.resolve();
    }),
    __store: store,
  };
});

// Import AFTER mock setup
import { createExpoSecureTokenStore } from "../expo-secure-token-store.js";

// Access the test store for cleanup — the mock factory above adds __store
const SecureStoreMock =
  (await import("expo-secure-store")) as typeof import("expo-secure-store") & {
    __store: Map<string, string>;
  };

beforeEach(() => {
  SecureStoreMock.__store.clear();
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
