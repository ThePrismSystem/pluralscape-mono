import { describe, expect, it } from "vitest";

import { generateStorageKey, parseStorageKey } from "../storage-key.js";

import type { BlobId, SystemId } from "@pluralscape/types";

describe("generateStorageKey", () => {
  it("produces {systemId}/{blobId} format", () => {
    const systemId = "sys_abc" as SystemId;
    const blobId = "blob_xyz" as BlobId;
    expect(generateStorageKey(systemId, blobId)).toBe("sys_abc/blob_xyz");
  });

  it("preserves UUID-style IDs", () => {
    const systemId = "sys_00000000-0000-0000-0000-000000000001" as SystemId;
    const blobId = "blob_00000000-0000-0000-0000-000000000002" as BlobId;
    const key = generateStorageKey(systemId, blobId);
    expect(key).toBe(
      "sys_00000000-0000-0000-0000-000000000001/blob_00000000-0000-0000-0000-000000000002",
    );
  });
});

describe("parseStorageKey", () => {
  it("parses a valid storage key", () => {
    const result = parseStorageKey("sys_abc/blob_xyz");
    expect(result).toEqual({ systemId: "sys_abc", blobId: "blob_xyz" });
  });

  it("returns null for a key with no slash", () => {
    expect(parseStorageKey("noslash")).toBeNull();
  });

  it("returns null for a key with leading slash", () => {
    expect(parseStorageKey("/blob_xyz")).toBeNull();
  });

  it("returns null for a key with trailing slash", () => {
    expect(parseStorageKey("sys_abc/")).toBeNull();
  });

  it("handles systemId containing only the first slash as separator", () => {
    // blobId containing slashes is valid — only first slash is the separator
    const result = parseStorageKey("sys_abc/blob_xyz/extra");
    expect(result).toEqual({ systemId: "sys_abc", blobId: "blob_xyz/extra" });
  });

  it("round-trips with generateStorageKey", () => {
    const systemId = "sys_round" as SystemId;
    const blobId = "blob_trip" as BlobId;
    const key = generateStorageKey(systemId, blobId);
    const parsed = parseStorageKey(key);
    expect(parsed?.systemId).toBe(systemId);
    expect(parsed?.blobId).toBe(blobId);
  });
});
