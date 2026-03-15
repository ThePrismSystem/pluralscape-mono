import { describe, expect, it } from "vitest";

import { MemoryBlobStorageAdapter } from "../adapters/memory-adapter.js";
import { BlobTooLargeError } from "../errors.js";

import { runBlobStorageContract } from "./blob-storage.contract.js";
import { makeBlobData, makeBytes } from "./test-helpers.js";

describe("MemoryBlobStorageAdapter", () => {
  runBlobStorageContract(() => new MemoryBlobStorageAdapter());
});

describe("MemoryBlobStorageAdapter-specific", () => {
  describe("maxSizeBytes", () => {
    it("rejects upload when data exceeds maxSizeBytes", async () => {
      const adapter = new MemoryBlobStorageAdapter({ maxSizeBytes: 10 });
      const data = makeBytes(0xff, 20);
      const params = makeBlobData(data);
      await expect(adapter.upload(params)).rejects.toThrow(BlobTooLargeError);
    });

    it("accepts upload when data is within maxSizeBytes", async () => {
      const adapter = new MemoryBlobStorageAdapter({ maxSizeBytes: 100 });
      const data = makeBytes(0xab, 50);
      const params = makeBlobData(data);
      const metadata = await adapter.upload(params);
      expect(metadata.sizeBytes).toBe(50);
    });

    it("does not enforce a size limit by default", async () => {
      const adapter = new MemoryBlobStorageAdapter();
      const data = makeBytes(0xcc, 1024);
      const params = makeBlobData(data);
      const metadata = await adapter.upload(params);
      expect(metadata.sizeBytes).toBe(1024);
    });
  });
});
