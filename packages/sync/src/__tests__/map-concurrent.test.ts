import { describe, expect, it } from "vitest";

import { mapConcurrent } from "../map-concurrent.js";

function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void } {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("mapConcurrent", () => {
  it("returns empty array for empty input", async () => {
    const results = await mapConcurrent([], 3, (x: number) => Promise.resolve(x * 2));
    expect(results).toEqual([]);
  });

  it("processes a single item", async () => {
    const results = await mapConcurrent([42], 3, (x) => Promise.resolve(x * 2));
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ status: "fulfilled", value: 84 });
  });

  it("processes all items when limit exceeds item count", async () => {
    const items = [1, 2, 3];
    const results = await mapConcurrent(items, 10, (x) => Promise.resolve(x + 1));

    expect(results).toHaveLength(3);
    expect(results.map((r) => (r as PromiseFulfilledResult<number>).value)).toEqual([2, 3, 4]);
  });

  it("processes items serially when limit is 1", async () => {
    const order: number[] = [];
    const items = [1, 2, 3, 4];

    await mapConcurrent(items, 1, (x) => {
      order.push(x);
      return Promise.resolve(x);
    });

    expect(order).toEqual([1, 2, 3, 4]);
  });

  it("limits max concurrent in-flight tasks", async () => {
    let activeTasks = 0;
    let maxConcurrent = 0;
    const concurrencyLimit = 2;
    const items = [1, 2, 3, 4, 5, 6];

    await mapConcurrent(items, concurrencyLimit, async (x) => {
      activeTasks++;
      if (activeTasks > maxConcurrent) {
        maxConcurrent = activeTasks;
      }
      await Promise.resolve();
      activeTasks--;
      return x;
    });

    expect(maxConcurrent).toBeLessThanOrEqual(concurrencyLimit);
    expect(maxConcurrent).toBeGreaterThan(0);
  });

  it("settles rejected items without blocking fulfilled items", async () => {
    const items = [1, 2, 3, 4];

    const results = await mapConcurrent(items, 4, (x) => {
      if (x === 2 || x === 4) {
        return Promise.reject(new Error(`fail-${String(x)}`));
      }
      return Promise.resolve(x * 10);
    });

    expect(results).toHaveLength(4);
    expect(results[0]).toEqual({ status: "fulfilled", value: 10 });
    expect(results[1]).toEqual({
      status: "rejected",
      reason: expect.objectContaining({ message: "fail-2" }),
    });
    expect(results[2]).toEqual({ status: "fulfilled", value: 30 });
    expect(results[3]).toEqual({
      status: "rejected",
      reason: expect.objectContaining({ message: "fail-4" }),
    });
  });

  it("preserves result order matching input order", async () => {
    const items = [5, 1, 4, 2, 3];
    const gates = new Map(items.map((v) => [v, deferred<number>()]));

    function gate(x: number) {
      const g = gates.get(x);
      if (!g) throw new Error(`no gate for ${String(x)}`);
      return g;
    }

    // Launch mapConcurrent — each worker blocks on its item's gate
    const resultPromise = mapConcurrent(items, 3, (x) => gate(x).promise);

    // Resolve in reverse input order so completion order differs from input order
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i] ?? 0;
      gate(item).resolve(item * 100);
      await Promise.resolve();
    }

    const results = await resultPromise;
    const values = results.map((r) => (r as PromiseFulfilledResult<number>).value);
    expect(values).toEqual([500, 100, 400, 200, 300]);
  });

  it("spawns zero workers when limit is 0 (edge case)", async () => {
    const items = [1, 2, 3];
    let callCount = 0;

    const results = await mapConcurrent(items, 0, (x) => {
      callCount++;
      return Promise.resolve(x);
    });

    // With limit=0, no workers spawn — fn is never called
    expect(callCount).toBe(0);
    // Slots are pre-allocated but never filled — verify none are settled results
    expect(results.filter((r) => (r as unknown) !== undefined)).toHaveLength(0);
  });

  it("returns PromiseSettledResult types for all results", async () => {
    const results = await mapConcurrent([1, 2], 2, (x) => {
      if (x === 2) return Promise.reject(new Error("boom"));
      return Promise.resolve(x);
    });

    expect(results[0]?.status).toBe("fulfilled");
    expect(results[1]?.status).toBe("rejected");
  });
});
