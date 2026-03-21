import { describe, expect, it } from "vitest";

import { mapConcurrent } from "../map-concurrent.js";

function resolved<T>(value: T): Promise<T> {
  return Promise.resolve(value);
}

describe("mapConcurrent", () => {
  it("returns empty array for empty input", async () => {
    const results = await mapConcurrent([], 3, (x: number) => resolved(x * 2));
    expect(results).toEqual([]);
  });

  it("processes a single item", async () => {
    const results = await mapConcurrent([42], 3, (x) => resolved(x * 2));
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ status: "fulfilled", value: 84 });
  });

  it("processes all items when limit exceeds item count", async () => {
    const items = [1, 2, 3];
    const results = await mapConcurrent(items, 10, (x) => resolved(x + 1));

    expect(results).toHaveLength(3);
    expect(results.map((r) => (r as PromiseFulfilledResult<number>).value)).toEqual([2, 3, 4]);
  });

  it("processes items serially when limit is 1", async () => {
    const order: number[] = [];
    const items = [1, 2, 3, 4];

    await mapConcurrent(items, 1, (x) => {
      order.push(x);
      return resolved(x);
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
      // Yield to allow other workers to start
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 5);
      });
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
      return resolved(x * 10);
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

    // Use varying delays so execution order differs from input order
    const results = await mapConcurrent(items, 3, async (x) => {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, x);
      });
      return x * 100;
    });

    const values = results.map((r) => (r as PromiseFulfilledResult<number>).value);
    expect(values).toEqual([500, 100, 400, 200, 300]);
  });

  it("spawns zero workers when limit is 0 (edge case)", async () => {
    const items = [1, 2, 3];
    const called = { count: 0 };

    const results = await mapConcurrent(items, 0, (x) => {
      called.count++;
      return resolved(x);
    });

    // With limit=0, Math.min(0, items.length) spawns 0 workers,
    // so no items are processed and the pre-allocated array is returned as-is
    expect(called.count).toBe(0);
    expect(results).toHaveLength(3);
  });

  it("handles async functions that return promises", async () => {
    const items = ["a", "b", "c"];

    const results = await mapConcurrent(items, 2, (s) => resolved(`${s}-processed`));

    expect(results).toHaveLength(3);
    for (const result of results) {
      expect(result.status).toBe("fulfilled");
    }
    expect((results[0] as PromiseFulfilledResult<string>).value).toBe("a-processed");
    expect((results[1] as PromiseFulfilledResult<string>).value).toBe("b-processed");
    expect((results[2] as PromiseFulfilledResult<string>).value).toBe("c-processed");
  });

  it("returns PromiseSettledResult types for all results", async () => {
    const results = await mapConcurrent([1, 2], 2, (x) => {
      if (x === 2) return Promise.reject(new Error("boom"));
      return resolved(x);
    });

    expect(results[0]?.status).toBe("fulfilled");
    expect(results[1]?.status).toBe("rejected");
  });
});
