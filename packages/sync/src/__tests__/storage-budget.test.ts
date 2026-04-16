import { describe, expect, it, vi } from "vitest";

import { EvictionCache, checkStorageBudget, selectEvictionCandidates } from "../storage-budget.js";

import type { StorageBudget } from "../types.js";

const TEST_BUDGET: StorageBudget = { maxTotalBytes: 1000 };

function docsMap(entries: [string, number][]): ReadonlyMap<string, number> {
  return new Map(entries);
}

// ── EvictionCache ───────────────────────────────────────────────────

describe("EvictionCache", () => {
  it("avoids re-sorting on consecutive calls when cache is valid", () => {
    const docs = new Map<string, number>([
      ["system-core-sys_a", 100],
      ["fronting-sys_a", 200],
      ["journal-sys_a-2024", 400],
      ["chat-ch_a-2025-01", 300],
      ["fronting-sys_a-2025-Q1", 200],
    ]);

    const cache = new EvictionCache();

    // Spy on Array.prototype.sort to count sort invocations
    const sortSpy = vi.spyOn(Array.prototype, "sort");
    const callsBefore = sortSpy.mock.calls.length;

    const result1 = cache.selectEvictionCandidates(docs, { maxTotalBytes: 700 });
    const sortCallsAfterFirst = sortSpy.mock.calls.length - callsBefore;

    // Second call without invalidation should not re-sort
    const result2 = cache.selectEvictionCandidates(docs, { maxTotalBytes: 700 });
    const sortCallsAfterSecond = sortSpy.mock.calls.length - callsBefore;

    expect(result1).toEqual(result2);
    expect(sortCallsAfterFirst).toBeGreaterThan(0);
    expect(sortCallsAfterSecond).toBe(sortCallsAfterFirst);

    sortSpy.mockRestore();
  });

  it("re-sorts after invalidation", () => {
    const docs = new Map<string, number>([
      ["system-core-sys_a", 100],
      ["fronting-sys_a", 600],
      ["journal-sys_a-2024", 400],
    ]);

    const cache = new EvictionCache();
    const result1 = cache.selectEvictionCandidates(docs, { maxTotalBytes: 700 });

    // Invalidate and add a new document
    cache.invalidate();
    docs.set("chat-ch_a-2025-01", 200);

    const result2 = cache.selectEvictionCandidates(docs, { maxTotalBytes: 700 });

    // Results should differ because the document set changed
    expect(result1).not.toEqual(result2);
  });

  it("returns empty when within budget regardless of cache state", () => {
    const docs = new Map<string, number>([
      ["system-core-sys_a", 200],
      ["fronting-sys_a", 300],
    ]);

    const cache = new EvictionCache();
    expect(cache.selectEvictionCandidates(docs, TEST_BUDGET)).toEqual([]);
    expect(cache.selectEvictionCandidates(docs, TEST_BUDGET)).toEqual([]);
  });
});

describe("checkStorageBudget", () => {
  it("reports within budget when total is under limit", () => {
    const docs = docsMap([
      ["system-core-sys_a", 200],
      ["fronting-sys_a", 300],
    ]);
    const status = checkStorageBudget(docs, TEST_BUDGET);
    expect(status.withinBudget).toBe(true);
    expect(status.usedBytes).toBe(500);
    expect(status.maxBytes).toBe(1000);
    expect(status.excessBytes).toBe(0);
  });

  it("reports over budget when total exceeds limit", () => {
    const docs = docsMap([
      ["system-core-sys_a", 600],
      ["fronting-sys_a", 500],
    ]);
    const status = checkStorageBudget(docs, TEST_BUDGET);
    expect(status.withinBudget).toBe(false);
    expect(status.usedBytes).toBe(1100);
    expect(status.excessBytes).toBe(100);
  });

  it("reports exactly at budget as within budget", () => {
    const docs = docsMap([["system-core-sys_a", 1000]]);
    const status = checkStorageBudget(docs, TEST_BUDGET);
    expect(status.withinBudget).toBe(true);
    expect(status.excessBytes).toBe(0);
  });

  it("handles empty document set", () => {
    const status = checkStorageBudget(docsMap([]), TEST_BUDGET);
    expect(status.withinBudget).toBe(true);
    expect(status.usedBytes).toBe(0);
  });
});

describe("selectEvictionCandidates", () => {
  it("returns empty when within budget", () => {
    const docs = docsMap([
      ["system-core-sys_a", 200],
      ["fronting-sys_a", 300],
    ]);
    expect(selectEvictionCandidates(docs, TEST_BUDGET)).toEqual([]);
  });

  it("never evicts system-core", () => {
    const docs = docsMap([
      ["system-core-sys_a", 800],
      ["fronting-sys_a", 300],
    ]);
    const candidates = selectEvictionCandidates(docs, TEST_BUDGET);
    expect(candidates).not.toContain("system-core-sys_a");
  });

  it("never evicts privacy-config", () => {
    const docs = docsMap([
      ["privacy-config-sys_a", 800],
      ["fronting-sys_a", 300],
    ]);
    const candidates = selectEvictionCandidates(docs, TEST_BUDGET);
    expect(candidates).not.toContain("privacy-config-sys_a");
  });

  it("evicts historical documents first", () => {
    const docs = docsMap([
      ["system-core-sys_a", 100],
      ["fronting-sys_a", 200],
      ["fronting-sys_a-2025-Q1", 300],
      ["journal-sys_a-2024", 400],
      ["chat-ch_a", 200],
    ]);
    // Total: 1200, budget: 1000, excess: 200
    const candidates = selectEvictionCandidates(docs, TEST_BUDGET);

    // journal-historical has lowest priority (index 8), should be evicted first
    expect(candidates[0]).toBe("journal-sys_a-2024");
  });

  it("stops evicting once under budget", () => {
    const docs = docsMap([
      ["system-core-sys_a", 100],
      ["fronting-sys_a", 200],
      ["journal-sys_a-2024", 400],
      ["chat-ch_a-2025-01", 300],
      ["fronting-sys_a-2025-Q1", 200],
    ]);
    // Total: 1200, excess: 200
    // journal-historical (400) evicted first → excess becomes -200 → stop
    const candidates = selectEvictionCandidates(docs, TEST_BUDGET);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toBe("journal-sys_a-2024");
  });

  it("evicts multiple documents if needed", () => {
    const docs = docsMap([
      ["system-core-sys_a", 100],
      ["fronting-sys_a", 200],
      ["fronting-sys_a-2025-Q1", 100],
      ["chat-ch_a-2025-01", 100],
      ["journal-sys_a-2024", 100],
      ["bucket-bkt_a", 600],
    ]);
    // Total: 1200, excess: 200
    // Eviction order: journal-historical (100) → chat-historical (100) → done
    const candidates = selectEvictionCandidates(docs, TEST_BUDGET);
    expect(candidates).toHaveLength(2);
  });

  it("skips malformed docIds without throwing", () => {
    const docs = docsMap([
      ["system-core-sys_a", 100],
      ["not-a-valid-doc-id", 500],
      ["fronting-sys_a", 600],
    ]);
    // Total: 1200, excess: 200. Malformed entry is excluded from eviction.
    const candidates = selectEvictionCandidates(docs, TEST_BUDGET);
    expect(candidates).not.toContain("not-a-valid-doc-id");
    expect(candidates).toContain("fronting-sys_a");
  });

  it("returns empty when only protected docs are over budget", () => {
    const docs = docsMap([
      ["system-core-sys_a", 600],
      ["privacy-config-sys_a", 500],
    ]);
    // Total: 1100, excess: 100. But both are protected → nothing to evict
    const candidates = selectEvictionCandidates(docs, TEST_BUDGET);
    expect(candidates).toEqual([]);
  });

  it("evicts everything evictable even if budget still exceeded", () => {
    const docs = docsMap([
      ["system-core-sys_a", 800],
      ["fronting-sys_a", 100],
      ["chat-ch_a", 200],
    ]);
    // Total: 1100, excess: 100. Evict fronting + chat (300 > 100), stops at fronting
    // Actually excess is 100 and fronting-historical has lower priority than chat
    // Let's just verify both can be returned if needed
    const candidates = selectEvictionCandidates(docs, { maxTotalBytes: 700 });
    // Excess: 400. Evict chat (200) then fronting (100) — still need more, both evicted
    expect(candidates).toContain("fronting-sys_a");
    expect(candidates).toContain("chat-ch_a");
  });
});
