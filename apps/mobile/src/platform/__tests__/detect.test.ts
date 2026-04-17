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
    Object.defineProperty(globalThis, "Worker", {
      value: undefined,
      configurable: true,
      writable: true,
    });
  });

  it("returns sqlite storage backend when navigator.storage.getDirectory and Worker are available", async () => {
    setNavigator({ storage: { getDirectory: () => Promise.resolve({}) } });
    Object.defineProperty(globalThis, "Worker", {
      value: function FakeWorker(): void {},
      configurable: true,
      writable: true,
    });
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

function setWorker(value: unknown): void {
  Object.defineProperty(globalThis, "Worker", {
    value,
    configurable: true,
    writable: true,
  });
}

function resetWorker(): void {
  Object.defineProperty(globalThis, "Worker", {
    value: undefined,
    configurable: true,
    writable: true,
  });
}

describe("detectPlatform — web + OPFS driver init fails", () => {
  afterEach(() => {
    resetNavigator();
    resetWorker();
    vi.doUnmock("../drivers/opfs-sqlite-driver.js");
    vi.resetModules();
  });

  it("falls back to indexeddb and records storageFallbackReason when OPFS init rejects", async () => {
    setNavigator({ storage: { getDirectory: () => Promise.resolve({}) } });
    setWorker(function FakeWorker(): void {});
    vi.doMock("../drivers/opfs-sqlite-driver.js", () => ({
      createOpfsSqliteDriver: () => Promise.reject(new Error("worker boot failed")),
    }));
    vi.doMock("../drivers/indexeddb-storage-adapter.js", () => ({
      createIndexedDbStorageAdapter: () => ({ __type: "storage-adapter" }),
    }));
    vi.doMock("../drivers/indexeddb-offline-queue-adapter.js", () => ({
      createIndexedDbOfflineQueueAdapter: () => ({ __type: "offline-queue-adapter" }),
    }));

    const { detectPlatform: detectFresh } = await import("../detect.js");
    const ctx = await detectFresh();
    expect(ctx.capabilities.storageBackend).toBe("indexeddb");
    expect(ctx.storage.backend).toBe("indexeddb");
    expect(ctx.capabilities.storageFallbackReason).toMatch(/worker boot failed/);
  });
});

describe("detectPlatform — IndexedDB context shape", () => {
  afterEach(() => {
    resetNavigator();
    resetWorker();
    vi.resetModules();
  });

  it("populates storageFallbackReason on the no-OPFS path", async () => {
    setNavigator({ storage: undefined });
    const { detectPlatform: detectFresh } = await import("../detect.js");
    const ctx = await detectFresh();
    expect(ctx.capabilities.storageBackend).toBe("indexeddb");
    expect(ctx.capabilities.storageFallbackReason).toBe("opfs-unavailable");
  });
});

describe("detectPlatform — observable fallback", () => {
  afterEach(() => {
    resetNavigator();
    resetWorker();
    vi.doUnmock("../drivers/opfs-sqlite-driver.js");
    vi.resetModules();
  });

  it("logs console.error when OPFS init throws", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    setNavigator({ storage: { getDirectory: () => Promise.resolve({}) } });
    setWorker(function FakeWorker(): void {});
    vi.doMock("../drivers/opfs-sqlite-driver.js", () => ({
      createOpfsSqliteDriver: () => Promise.reject(new Error("worker boot failed")),
    }));
    vi.doMock("../drivers/indexeddb-storage-adapter.js", () => ({
      createIndexedDbStorageAdapter: () => ({ __type: "storage-adapter" }),
    }));
    vi.doMock("../drivers/indexeddb-offline-queue-adapter.js", () => ({
      createIndexedDbOfflineQueueAdapter: () => ({ __type: "offline-queue-adapter" }),
    }));
    const { detectPlatform: detectFresh } = await import("../detect.js");
    await detectFresh();
    expect(errSpy).toHaveBeenCalledWith(
      expect.stringContaining("OPFS storage unavailable"),
      expect.objectContaining({ reason: expect.stringContaining("worker boot failed") as unknown }),
    );
    errSpy.mockRestore();
  });
});
