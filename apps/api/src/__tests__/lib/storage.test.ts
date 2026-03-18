import { afterEach, describe, expect, it, vi } from "vitest";

import {
  _resetStorageAdapterForTesting,
  getQuotaService,
  getStorageAdapter,
  initStorageAdapter,
  setStorageAdapterForTesting,
} from "../../lib/storage.js";
import { mockDb } from "../helpers/mock-db.js";

import type { BlobStorageAdapter } from "@pluralscape/storage";

function fakeAdapter(): BlobStorageAdapter {
  return {
    upload: vi.fn(),
    download: vi.fn(),
    delete: vi.fn(),
    exists: vi.fn(),
    createPresignedUploadUrl: vi.fn(),
    createPresignedDownloadUrl: vi.fn(),
    supportsPresignedUrls: true,
  } as never;
}

describe("storage", () => {
  afterEach(() => {
    _resetStorageAdapterForTesting();
    vi.restoreAllMocks();
  });

  describe("getStorageAdapter", () => {
    it("throws when not initialized", () => {
      expect(() => getStorageAdapter()).toThrow("Storage adapter not initialized");
    });

    it("returns adapter after initStorageAdapter", () => {
      const adapter = fakeAdapter();
      initStorageAdapter(adapter);

      expect(getStorageAdapter()).toBe(adapter);
    });
  });

  describe("initStorageAdapter", () => {
    it("sets the adapter so getStorageAdapter returns it", () => {
      const adapter = fakeAdapter();
      initStorageAdapter(adapter);

      expect(getStorageAdapter()).toBe(adapter);
    });
  });

  describe("setStorageAdapterForTesting", () => {
    it("overrides the adapter for tests", () => {
      const first = fakeAdapter();
      const second = fakeAdapter();

      initStorageAdapter(first);
      setStorageAdapterForTesting(second);

      expect(getStorageAdapter()).toBe(second);
    });
  });

  describe("_resetStorageAdapterForTesting", () => {
    it("clears the cached adapter so getStorageAdapter throws again", () => {
      initStorageAdapter(fakeAdapter());
      _resetStorageAdapterForTesting();

      expect(() => getStorageAdapter()).toThrow("Storage adapter not initialized");
    });
  });

  describe("getQuotaService", () => {
    it("returns a BlobQuotaService instance", () => {
      const { db } = mockDb();

      const service = getQuotaService(db);

      expect(service).toBeDefined();
      expect(service).toHaveProperty("checkQuota");
      expect(service).toHaveProperty("getUsage");
      expect(service).toHaveProperty("assertQuota");
    });
  });
});
