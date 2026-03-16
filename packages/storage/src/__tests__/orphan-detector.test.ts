import { describe, expect, it, vi } from "vitest";

import { OrphanBlobDetector } from "../quota/orphan-detector.js";

import type { OrphanBlobQuery } from "../quota/orphan-detector.js";

function mockOrphanQuery(keys: readonly string[]): {
  query: OrphanBlobQuery;
  queryFn: ReturnType<typeof vi.fn>;
} {
  const queryFn = vi.fn().mockResolvedValue(keys);
  return { query: { findOrphanedKeys: queryFn }, queryFn };
}

describe("OrphanBlobDetector", () => {
  it("returns orphaned keys from the query", async () => {
    const orphans = ["sys_a/blob_1", "sys_a/blob_2"];
    const { query } = mockOrphanQuery(orphans);
    const detector = new OrphanBlobDetector(query);

    const result = await detector.findOrphans("sys_a");
    expect(result).toEqual(orphans);
  });

  it("returns empty array when no orphans exist", async () => {
    const { query } = mockOrphanQuery([]);
    const detector = new OrphanBlobDetector(query);

    const result = await detector.findOrphans("sys_clean");
    expect(result).toEqual([]);
  });

  it("uses default grace period of 24 hours", async () => {
    const { query, queryFn } = mockOrphanQuery([]);
    const detector = new OrphanBlobDetector(query);

    await detector.findOrphans("sys_a");
    expect(queryFn).toHaveBeenCalledWith("sys_a", 86_400_000);
  });

  it("uses custom grace period when configured", async () => {
    const { query, queryFn } = mockOrphanQuery([]);
    const detector = new OrphanBlobDetector(query, { gracePeriodMs: 3_600_000 });

    await detector.findOrphans("sys_a");
    expect(queryFn).toHaveBeenCalledWith("sys_a", 3_600_000);
  });
});
