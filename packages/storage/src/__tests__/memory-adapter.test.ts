import { describe } from "vitest";

import { MemoryBlobStorageAdapter } from "../adapters/memory-adapter.js";

import { runBlobStorageContract } from "./blob-storage.contract.js";

describe("MemoryBlobStorageAdapter", () => {
  runBlobStorageContract(() => new MemoryBlobStorageAdapter());
});
