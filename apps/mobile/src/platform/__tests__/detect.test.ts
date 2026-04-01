import { describe, expect, it, vi } from "vitest";

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
