import { describe, expect, it, vi } from "vitest";

import { DEFAULT_GRACE_PERIOD_MS, OrphanBlobDetector } from "../quota/orphan-detector.js";

import type { OrphanBlobQuery } from "../quota/orphan-detector.js";
import type { StorageKey, SystemId } from "@pluralscape/types";

function mockOrphanQuery(keys: readonly StorageKey[]): {
  query: OrphanBlobQuery;
  queryFn: ReturnType<typeof vi.fn>;
} {
  const queryFn = vi.fn().mockResolvedValue(keys);
  return { query: { findOrphanedKeys: queryFn }, queryFn };
}

describe("OrphanBlobDetector", () => {
  it("returns orphaned keys from the query", async () => {
    const orphans = ["sys_a/blob_1" as StorageKey, "sys_a/blob_2" as StorageKey];
    const { query } = mockOrphanQuery(orphans);
    const detector = new OrphanBlobDetector(query);

    const result = await detector.findOrphans("sys_a" as SystemId);
    expect(result).toEqual(orphans);
  });

  it("returns empty array when no orphans exist", async () => {
    const { query } = mockOrphanQuery([]);
    const detector = new OrphanBlobDetector(query);

    const result = await detector.findOrphans("sys_clean" as SystemId);
    expect(result).toEqual([]);
  });

  it("uses default grace period of 24 hours", async () => {
    const { query, queryFn } = mockOrphanQuery([]);
    const detector = new OrphanBlobDetector(query);

    await detector.findOrphans("sys_a" as SystemId);
    expect(queryFn).toHaveBeenCalledWith("sys_a" as SystemId, DEFAULT_GRACE_PERIOD_MS);
  });

  it("uses custom grace period when configured", async () => {
    const { query, queryFn } = mockOrphanQuery([]);
    const detector = new OrphanBlobDetector(query, { gracePeriodMs: 3_600_000 });

    await detector.findOrphans("sys_a" as SystemId);
    expect(queryFn).toHaveBeenCalledWith("sys_a" as SystemId, 3_600_000);
  });

  it("propagates query errors", async () => {
    const failingQuery: OrphanBlobQuery = {
      findOrphanedKeys: vi.fn().mockRejectedValue(new Error("Query failed")),
    };
    const detector = new OrphanBlobDetector(failingQuery);

    await expect(detector.findOrphans("sys_a" as SystemId)).rejects.toThrow("Query failed");
  });
});
