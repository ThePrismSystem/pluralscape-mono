import { describe, expect, it } from "vitest";

import {
  CreateImportJobBodySchema,
  UpdateImportJobBodySchema,
  ImportJobQuerySchema,
} from "../import-job.js";

describe("CreateImportJobBodySchema", () => {
  it("accepts a valid simply-plural create body", () => {
    const result = CreateImportJobBodySchema.safeParse({
      source: "simply-plural",
      selectedCategories: { members: true, groups: true },
      avatarMode: "api",
    });
    expect(result.success).toBe(true);
  });

  it("accepts pluralkit source", () => {
    const result = CreateImportJobBodySchema.safeParse({
      source: "pluralkit",
      selectedCategories: {},
      avatarMode: "skip",
    });
    expect(result.success).toBe(true);
  });

  it("accepts pluralscape source", () => {
    const result = CreateImportJobBodySchema.safeParse({
      source: "pluralscape",
      selectedCategories: {},
      avatarMode: "zip",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid source", () => {
    const result = CreateImportJobBodySchema.safeParse({
      source: "invalid-source",
      selectedCategories: {},
      avatarMode: "api",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid avatarMode", () => {
    const result = CreateImportJobBodySchema.safeParse({
      source: "simply-plural",
      selectedCategories: {},
      avatarMode: "cloud",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing source", () => {
    const result = CreateImportJobBodySchema.safeParse({
      selectedCategories: {},
      avatarMode: "api",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing selectedCategories", () => {
    const result = CreateImportJobBodySchema.safeParse({
      source: "simply-plural",
      avatarMode: "api",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing avatarMode", () => {
    const result = CreateImportJobBodySchema.safeParse({
      source: "simply-plural",
      selectedCategories: {},
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-boolean values in selectedCategories", () => {
    const result = CreateImportJobBodySchema.safeParse({
      source: "simply-plural",
      selectedCategories: { members: "yes" },
      avatarMode: "api",
    });
    expect(result.success).toBe(false);
  });

  it("strips unknown properties", () => {
    const result = CreateImportJobBodySchema.safeParse({
      source: "simply-plural",
      selectedCategories: {},
      avatarMode: "api",
      extra: "nope",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect("extra" in result.data).toBe(false);
    }
  });
});

describe("UpdateImportJobBodySchema", () => {
  it("accepts a partial status update", () => {
    const result = UpdateImportJobBodySchema.safeParse({ status: "importing" });
    expect(result.success).toBe(true);
  });

  it("accepts every valid status", () => {
    for (const status of ["pending", "validating", "importing", "completed", "failed"] as const) {
      const result = UpdateImportJobBodySchema.safeParse({ status });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid status", () => {
    const result = UpdateImportJobBodySchema.safeParse({ status: "paused" });
    expect(result.success).toBe(false);
  });

  it("accepts progressPercent between 0 and 100", () => {
    for (const progressPercent of [0, 50, 100]) {
      const result = UpdateImportJobBodySchema.safeParse({ progressPercent });
      expect(result.success).toBe(true);
    }
  });

  it("rejects progressPercent below 0", () => {
    const result = UpdateImportJobBodySchema.safeParse({ progressPercent: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects progressPercent above 100", () => {
    const result = UpdateImportJobBodySchema.safeParse({ progressPercent: 101 });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer progressPercent", () => {
    const result = UpdateImportJobBodySchema.safeParse({ progressPercent: 50.5 });
    expect(result.success).toBe(false);
  });

  it("accepts warningCount as non-negative integer", () => {
    const result = UpdateImportJobBodySchema.safeParse({ warningCount: 5 });
    expect(result.success).toBe(true);
  });

  it("rejects negative warningCount", () => {
    const result = UpdateImportJobBodySchema.safeParse({ warningCount: -1 });
    expect(result.success).toBe(false);
  });

  it("accepts chunksTotal as positive integer", () => {
    const result = UpdateImportJobBodySchema.safeParse({ chunksTotal: 10 });
    expect(result.success).toBe(true);
  });

  it("accepts chunksTotal null", () => {
    const result = UpdateImportJobBodySchema.safeParse({ chunksTotal: null });
    expect(result.success).toBe(true);
  });

  it("rejects negative chunksTotal", () => {
    const result = UpdateImportJobBodySchema.safeParse({ chunksTotal: -1 });
    expect(result.success).toBe(false);
  });

  it("accepts chunksCompleted as non-negative integer", () => {
    const result = UpdateImportJobBodySchema.safeParse({ chunksCompleted: 0 });
    expect(result.success).toBe(true);
  });

  it("rejects negative chunksCompleted", () => {
    const result = UpdateImportJobBodySchema.safeParse({ chunksCompleted: -1 });
    expect(result.success).toBe(false);
  });

  it("accepts a valid errorLog entry", () => {
    const result = UpdateImportJobBodySchema.safeParse({
      errorLog: [
        {
          entityType: "member",
          entityId: "abc",
          message: "failed",
          fatal: true,
          recoverable: true,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts errorLog with null entityId", () => {
    const result = UpdateImportJobBodySchema.safeParse({
      errorLog: [
        {
          entityType: "unknown",
          entityId: null,
          message: "failed",
          fatal: false,
          recoverable: false,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts errorLog set to null", () => {
    const result = UpdateImportJobBodySchema.safeParse({ errorLog: null });
    expect(result.success).toBe(true);
  });

  it("rejects errorLog entry with missing message", () => {
    const result = UpdateImportJobBodySchema.safeParse({
      errorLog: [{ entityType: "member", entityId: "abc", fatal: true, recoverable: true }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid entityType in errorLog", () => {
    const result = UpdateImportJobBodySchema.safeParse({
      errorLog: [
        {
          entityType: "banana",
          entityId: null,
          message: "failed",
          fatal: true,
          recoverable: true,
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid checkpointState", () => {
    const result = UpdateImportJobBodySchema.safeParse({
      checkpointState: {
        schemaVersion: 1,
        checkpoint: {
          completedCollections: ["member"],
          currentCollection: "group",
          currentCollectionLastSourceId: "abc",
        },
        options: {
          selectedCategories: { members: true },
          avatarMode: "api",
        },
        totals: {
          perCollection: {
            member: { total: 10, imported: 5, updated: 0, skipped: 1, failed: 0 },
          },
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts checkpointState set to null", () => {
    const result = UpdateImportJobBodySchema.safeParse({ checkpointState: null });
    expect(result.success).toBe(true);
  });

  it("rejects checkpointState with invalid schemaVersion", () => {
    const result = UpdateImportJobBodySchema.safeParse({
      checkpointState: {
        schemaVersion: 99,
        checkpoint: {
          completedCollections: [],
          currentCollection: "member",
          currentCollectionLastSourceId: null,
        },
        options: { selectedCategories: {}, avatarMode: "api" },
        totals: { perCollection: {} },
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects checkpointState with invalid avatarMode", () => {
    const result = UpdateImportJobBodySchema.safeParse({
      checkpointState: {
        schemaVersion: 1,
        checkpoint: {
          completedCollections: [],
          currentCollection: "member",
          currentCollectionLastSourceId: null,
        },
        options: { selectedCategories: {}, avatarMode: "cloud" },
        totals: { perCollection: {} },
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty update", () => {
    const result = UpdateImportJobBodySchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("ImportJobQuerySchema", () => {
  it("accepts empty query", () => {
    const result = ImportJobQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("parses status filter", () => {
    const result = ImportJobQuerySchema.safeParse({ status: "importing" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("importing");
  });

  it("rejects invalid status filter", () => {
    const result = ImportJobQuerySchema.safeParse({ status: "paused" });
    expect(result.success).toBe(false);
  });

  it("parses source filter", () => {
    const result = ImportJobQuerySchema.safeParse({ source: "simply-plural" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.source).toBe("simply-plural");
  });

  it("rejects invalid source filter", () => {
    const result = ImportJobQuerySchema.safeParse({ source: "notion" });
    expect(result.success).toBe(false);
  });
});
