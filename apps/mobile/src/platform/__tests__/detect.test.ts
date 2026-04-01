import { afterEach, describe, expect, it, vi } from "vitest";

// Mock react-native Platform to report "web" (vitest runs in node)
vi.mock("react-native", () => ({
  Platform: { OS: "web" },
}));

// Mock driver stubs so the web path doesn't throw (real impls come in Tasks 4-5)
vi.mock("../drivers/indexeddb-storage-adapter.js", () => ({
  createIndexedDbStorageAdapter: () => ({ __type: "storage-adapter" }),
}));

vi.mock("../drivers/indexeddb-offline-queue-adapter.js", () => ({
  createIndexedDbOfflineQueueAdapter: () => ({
    __type: "offline-queue-adapter",
  }),
}));

vi.mock("../drivers/opfs-sqlite-driver.js", () => ({
  createOpfsSqliteDriver: () => Promise.resolve({ __type: "opfs-driver" }),
}));

import { detectPlatform } from "../detect.js";

describe("detectPlatform", () => {
  it("returns indexeddb backend when Platform.OS is web", async () => {
    const ctx = await detectPlatform();
    expect(ctx.capabilities.storageBackend).toBe("indexeddb");
    expect(ctx.storage.backend).toBe("indexeddb");
  });

  it("sets hasBiometric false on web", async () => {
    const ctx = await detectPlatform();
    expect(ctx.capabilities.hasBiometric).toBe(false);
  });

  it("sets hasBackgroundSync false on web", async () => {
    const ctx = await detectPlatform();
    expect(ctx.capabilities.hasBackgroundSync).toBe(false);
  });

  it("sets hasSecureStorage false on web", async () => {
    const ctx = await detectPlatform();
    expect(ctx.capabilities.hasSecureStorage).toBe(false);
  });

  it("initializes the crypto adapter", async () => {
    const ctx = await detectPlatform();
    expect(ctx.crypto.isReady()).toBe(true);
  });
});

function setNavigator(value: unknown): void {
  Object.defineProperty(globalThis, "navigator", {
    value,
    configurable: true,
    writable: true,
  });
}

function resetNavigator(): void {
  Object.defineProperty(globalThis, "navigator", {
    value: undefined,
    configurable: true,
    writable: true,
  });
}

describe("detectPlatform — web + OPFS available", () => {
  afterEach(() => {
    resetNavigator();
  });

  it("returns sqlite storage backend when navigator.storage.getDirectory is a function", async () => {
    setNavigator({ storage: { getDirectory: () => Promise.resolve({}) } });
    const ctx = await detectPlatform();
    expect(ctx.capabilities.storageBackend).toBe("sqlite");
    expect(ctx.storage.backend).toBe("sqlite");
  });
});

describe("detectPlatform — web + navigator.storage throws", () => {
  afterEach(() => {
    resetNavigator();
  });

  it("falls back to indexeddb when navigator.storage access throws", async () => {
    setNavigator(
      new Proxy(
        {},
        {
          get(_target, prop) {
            if (prop === "storage") throw new Error("storage access denied");
            return undefined;
          },
        },
      ),
    );
    const ctx = await detectPlatform();
    expect(ctx.capabilities.storageBackend).toBe("indexeddb");
    expect(ctx.storage.backend).toBe("indexeddb");
  });
});
