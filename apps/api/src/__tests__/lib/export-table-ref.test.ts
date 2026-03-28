import { describe, expect, it } from "vitest";

import { batchedManifestQueries, exportRef, keysetAfter } from "../../lib/export-table-ref.js";

import type { DecodedCompositeCursor } from "../../lib/pagination.js";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

// ── exportRef ──────────────────────────────────────────────────────

describe("exportRef", () => {
  it("extracts standard columns from a table-like object", () => {
    const mockTable = {
      id: { name: "id" } as PgColumn,
      systemId: { name: "system_id" } as PgColumn,
      encryptedData: { name: "encrypted_data" } as PgColumn,
      updatedAt: { name: "updated_at" } as PgColumn,
    } as PgTable & {
      id: PgColumn;
      systemId: PgColumn;
      encryptedData: PgColumn;
      updatedAt: PgColumn;
    };

    const ref = exportRef(mockTable);

    expect(ref.table).toBe(mockTable);
    expect(ref.id).toBe(mockTable.id);
    expect(ref.systemId).toBe(mockTable.systemId);
    expect(ref.encryptedData).toBe(mockTable.encryptedData);
    expect(ref.updatedAt).toBe(mockTable.updatedAt);
    expect(ref.archived).toBeUndefined();
  });

  it("includes archived column when present", () => {
    const archivedCol = { name: "archived" } as PgColumn;
    const mockTable = {
      id: { name: "id" } as PgColumn,
      systemId: { name: "system_id" } as PgColumn,
      encryptedData: { name: "encrypted_data" } as PgColumn,
      updatedAt: { name: "updated_at" } as PgColumn,
      archived: archivedCol,
    } as PgTable & {
      id: PgColumn;
      systemId: PgColumn;
      encryptedData: PgColumn;
      updatedAt: PgColumn;
      archived: PgColumn;
    };

    const ref = exportRef(mockTable);

    expect(ref.archived).toBe(archivedCol);
  });
});

// ── keysetAfter ────────────────────────────────────────────────────

describe("keysetAfter", () => {
  it("returns a SQL expression (non-null)", () => {
    // keysetAfter delegates to drizzle's or(gt(...), and(eq(...), gt(...)))
    // which requires real PgColumn instances to produce SQL. We test that it
    // doesn't throw and returns a truthy value — deeper SQL correctness is
    // covered by integration tests.
    //
    // Import a real table to get actual PgColumn instances:
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    const { members } = require("@pluralscape/db/pg") as typeof import("@pluralscape/db/pg");
    const cursor: DecodedCompositeCursor = { sortValue: 1000, id: "test-id" };

    const result = keysetAfter(members.updatedAt, members.id, cursor);

    expect(result).toBeTruthy();
  });
});

// ── batchedManifestQueries ─────────────────────────────────────────

describe("batchedManifestQueries", () => {
  it("returns empty array for empty input", async () => {
    const result = await batchedManifestQueries([]);
    expect(result).toEqual([]);
  });

  it("executes all tasks and returns results in order", async () => {
    const tasks = [() => Promise.resolve("a"), () => Promise.resolve("b"), () => Promise.resolve("c")];

    const result = await batchedManifestQueries(tasks);

    expect(result).toEqual(["a", "b", "c"]);
  });

  it("limits concurrency to batch size", async () => {
    let maxConcurrent = 0;
    let currentConcurrent = 0;

    const makeTask = (value: number) => async () => {
      currentConcurrent++;
      if (currentConcurrent > maxConcurrent) {
        maxConcurrent = currentConcurrent;
      }
      // Yield to allow other tasks in the same batch to start
      await new Promise((resolve) => setTimeout(resolve, 1));
      currentConcurrent--;
      return value;
    };

    // Create 12 tasks — should run in batches of 5 (5 + 5 + 2)
    const tasks = Array.from({ length: 12 }, (_, i) => makeTask(i));
    const result = await batchedManifestQueries(tasks);

    expect(result).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    // MANIFEST_BATCH_SIZE is 5, so max concurrent should be at most 5
    expect(maxConcurrent).toBeLessThanOrEqual(5);
  });

  it("runs batches sequentially — later batches start after earlier ones finish", async () => {
    const executionOrder: number[] = [];

    const makeTask = (value: number, delayMs: number) => async () => {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      executionOrder.push(value);
      return value;
    };

    // Batch 1: tasks 0-4, batch 2: tasks 5-9
    // Task 5 (batch 2, fast) should complete after all of batch 1
    const tasks = [
      makeTask(0, 10),
      makeTask(1, 10),
      makeTask(2, 10),
      makeTask(3, 10),
      makeTask(4, 10),
      makeTask(5, 1), // Fast task in batch 2
      makeTask(6, 1),
    ];

    await batchedManifestQueries(tasks);

    // All batch 1 items (0-4) should appear before batch 2 items (5-6)
    const batch1Indices = [0, 1, 2, 3, 4].map((v) => executionOrder.indexOf(v));
    const batch2Indices = [5, 6].map((v) => executionOrder.indexOf(v));
    const maxBatch1Index = Math.max(...batch1Indices);
    const minBatch2Index = Math.min(...batch2Indices);

    expect(maxBatch1Index).toBeLessThan(minBatch2Index);
  });

  it("propagates errors from tasks", async () => {
    const tasks = [
      () => Promise.resolve(1),
      () => Promise.reject(new Error("task failed")),
      () => Promise.resolve(3),
    ];

    await expect(batchedManifestQueries(tasks)).rejects.toThrow("task failed");
  });

  it("handles exactly one batch worth of tasks", async () => {
    const tasks = Array.from({ length: 5 }, (_, i) => () => Promise.resolve(i));
    const result = await batchedManifestQueries(tasks);
    expect(result).toEqual([0, 1, 2, 3, 4]);
  });

  it("handles single task", async () => {
    const result = await batchedManifestQueries([() => Promise.resolve("only")]);
    expect(result).toEqual(["only"]);
  });
});
