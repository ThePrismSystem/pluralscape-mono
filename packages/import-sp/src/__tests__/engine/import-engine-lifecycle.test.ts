import { describe, expect, it } from "vitest";

import { runImport } from "../../engine/import-engine.js";
import { CHECKPOINT_CHUNK_SIZE } from "../../import-sp.constants.js";
import { createFakeImportSource, type FakeSourceData } from "../../sources/fake-source.js";
import {
  ALL_CATEGORIES_ON,
  createFakePersister,
  noopProgress,
} from "../helpers/import-engine-fixtures.js";

import type { ImportDataSource } from "../../sources/source.types.js";

describe("runImport — legacy bucket synthesis", () => {
  it("synthesizes Public/Trusted/Private when privacyBuckets is absent", async () => {
    const data: FakeSourceData = {
      members: [
        { _id: "m_a", name: "Aria", private: true },
        { _id: "m_b", name: "Brook", preventTrusted: true },
      ],
    };
    const source = createFakeImportSource(data);
    const persister = createFakePersister();
    const result = await runImport({
      source,
      persister,
      options: {
        selectedCategories: ALL_CATEGORIES_ON,
        avatarMode: "skip",
      },
      onProgress: noopProgress,
    });
    expect(result.outcome).toBe("completed");
    const bucketUpserts = persister.upserted.filter((e) => e.entityType === "privacy-bucket");
    expect(bucketUpserts).toHaveLength(3);
    expect(bucketUpserts.map((e) => e.sourceEntityId).sort()).toEqual([
      "synthetic:private",
      "synthetic:public",
      "synthetic:trusted",
    ]);
    expect(persister.upserted.filter((e) => e.entityType === "member")).toHaveLength(2);
  });

  it("synthesizes legacy buckets when all privacyBuckets fail validation", async () => {
    // Two bucket docs that both fail Zod validation (missing required `name`).
    // The engine should treat the mapped-bucket count as zero and synthesize
    // the three legacy buckets so members can still resolve their
    // `synthetic:*` references.
    const data: FakeSourceData = {
      privacyBuckets: [{ _id: "b_bad1" }, { _id: "b_bad2" }],
      members: [{ _id: "m_a", name: "Aria", private: true }],
    };
    const source = createFakeImportSource(data);
    const persister = createFakePersister();
    const result = await runImport({
      source,
      persister,
      options: {
        selectedCategories: ALL_CATEGORIES_ON,
        avatarMode: "skip",
      },
      onProgress: noopProgress,
    });
    expect(result.outcome).toBe("completed");
    const bucketUpserts = persister.upserted.filter((e) => e.entityType === "privacy-bucket");
    expect(bucketUpserts.map((e) => e.sourceEntityId).sort()).toEqual([
      "synthetic:private",
      "synthetic:public",
      "synthetic:trusted",
    ]);
    // Two validation failures, one per bad bucket doc.
    const bucketErrors = result.errors.filter((e) => e.entityType === "privacy-bucket");
    expect(bucketErrors).toHaveLength(2);
    expect(bucketErrors.map((e) => e.entityId).sort()).toEqual(["b_bad1", "b_bad2"]);
    for (const error of bucketErrors) {
      expect(error.fatal).toBe(false);
      expect(error.message).toContain("validation");
    }
    // The member was persisted (resolved against the synthetic private bucket).
    expect(persister.upserted.filter((e) => e.entityType === "member")).toHaveLength(1);
  });

  it("does not synthesize legacy buckets when privacyBuckets has data", async () => {
    const data: FakeSourceData = {
      privacyBuckets: [{ _id: "b_pub", name: "Public" }],
      members: [{ _id: "m_a", name: "Aria", buckets: ["b_pub"] }],
    };
    const source = createFakeImportSource(data);
    const persister = createFakePersister();
    const result = await runImport({
      source,
      persister,
      options: {
        selectedCategories: ALL_CATEGORIES_ON,
        avatarMode: "skip",
      },
      onProgress: noopProgress,
    });
    expect(result.outcome).toBe("completed");
    const bucketUpserts = persister.upserted.filter((e) => e.entityType === "privacy-bucket");
    expect(bucketUpserts).toHaveLength(1);
    expect(bucketUpserts[0]?.sourceEntityId).toBe("b_pub");
  });
});

describe("runImport — checkpoint frequency", () => {
  it("flushes and reports progress every CHECKPOINT_CHUNK_SIZE docs", async () => {
    const total = CHECKPOINT_CHUNK_SIZE * 2;
    const members = Array.from({ length: total }, (_, i) => ({
      _id: `m_${String(i).padStart(4, "0")}`,
      name: `Member ${String(i)}`,
    }));
    const data: FakeSourceData = { members };
    const source = createFakeImportSource(data);
    const persister = createFakePersister();
    let progressCalls = 0;
    const result = await runImport({
      source,
      persister,
      options: {
        selectedCategories: ALL_CATEGORIES_ON,
        avatarMode: "skip",
      },
      onProgress: () => {
        progressCalls += 1;
        return Promise.resolve();
      },
    });
    expect(result.outcome).toBe("completed");
    expect(persister.upserted.filter((e) => e.entityType === "member")).toHaveLength(total);
    // Two intra-collection chunk flushes plus one final flush at collection
    // end means at least three onProgress invocations.
    expect(progressCalls).toBeGreaterThanOrEqual(3);
    expect(persister.flushCount).toBeGreaterThanOrEqual(3);
  });
});

describe("runImport — abort signal", () => {
  it("returns aborted immediately when signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const source = createFakeImportSource({
      privacyBuckets: [{ _id: "bk1", name: "Public", description: null }],
    });
    const result = await runImport({
      source,
      persister: createFakePersister(),
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
      abortSignal: controller.signal,
    });
    expect(result.outcome).toBe("aborted");
    await source.close();
  });
});

describe("runImport — source.close() lifecycle", () => {
  it("calls source.close() on successful completion", async () => {
    let closed = false;
    const source = createFakeImportSource({});
    const wrappedSource: ImportDataSource = {
      ...source,
      async close() {
        await source.close();
        closed = true;
      },
    };
    const persister = createFakePersister();
    await runImport({
      source: wrappedSource,
      persister,
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
    });
    expect(closed).toBe(true);
  });

  it("calls source.close() even when iteration throws", async () => {
    let closed = false;
    const source: ImportDataSource = {
      mode: "fake",
      listCollections() {
        return Promise.resolve(["members"]);
      },
      async *iterate() {
        await Promise.resolve();
        throw new Error("boom");
      },
      close() {
        closed = true;
        return Promise.resolve();
      },
    };
    const persister = createFakePersister();
    await runImport({
      source,
      persister,
      options: { selectedCategories: { member: true }, avatarMode: "skip" },
      onProgress: noopProgress,
    });
    expect(closed).toBe(true);
  });
});

describe("runImport — abort signal during iteration", () => {
  it("aborts mid-iteration after processing a doc event", async () => {
    const controller = new AbortController();
    const source: ImportDataSource = {
      mode: "fake",
      listCollections() {
        return Promise.resolve(["members"]);
      },
      async *iterate(collection) {
        if (collection !== "members") return;
        await Promise.resolve();
        yield {
          kind: "doc" as const,
          collection: "members" as const,
          sourceId: "m1",
          document: { _id: "m1", name: "Aria" },
        };
        // Abort BEFORE yielding m2. The engine checked the signal after
        // processing m1 (still false), then resumes the generator, which
        // sets aborted=true and yields m2. The engine processes m2, then
        // checks the signal again (now true) and returns "aborted".
        controller.abort();
        yield {
          kind: "doc" as const,
          collection: "members" as const,
          sourceId: "m2",
          document: { _id: "m2", name: "Brook" },
        };
        yield {
          kind: "doc" as const,
          collection: "members" as const,
          sourceId: "m3",
          document: { _id: "m3", name: "Cass" },
        };
      },
      close() {
        return Promise.resolve();
      },
    };
    const persister = createFakePersister();
    const result = await runImport({
      source,
      persister,
      options: { selectedCategories: { member: true }, avatarMode: "skip" },
      onProgress: noopProgress,
      abortSignal: controller.signal,
    });
    expect(result.outcome).toBe("aborted");
    // m1 and m2 were processed (m2 was already yielded before the check);
    // m3 was not reached.
    expect(
      persister.upserted.filter((e) => e.entityType === "member").map((e) => e.sourceEntityId),
    ).toEqual(["m1", "m2"]);
  });

  it("aborts mid-iteration after processing a drop event", async () => {
    const controller = new AbortController();
    const source: ImportDataSource = {
      mode: "fake",
      listCollections() {
        return Promise.resolve(["members"]);
      },
      async *iterate(collection) {
        if (collection !== "members") return;
        await Promise.resolve();
        // Abort BEFORE yielding the drop. The engine resumes the generator,
        // which sets aborted=true and yields the drop. The engine processes
        // the drop, checks the signal (now true), and returns "aborted".
        controller.abort();
        yield {
          kind: "drop" as const,
          collection: "members" as const,
          sourceId: "m1",
          reason: "non-object body",
        };
        yield {
          kind: "doc" as const,
          collection: "members" as const,
          sourceId: "m2",
          document: { _id: "m2", name: "Brook" },
        };
      },
      close() {
        return Promise.resolve();
      },
    };
    const persister = createFakePersister();
    const result = await runImport({
      source,
      persister,
      options: { selectedCategories: { member: true }, avatarMode: "skip" },
      onProgress: noopProgress,
      abortSignal: controller.signal,
    });
    expect(result.outcome).toBe("aborted");
    // The drop was processed (abort was set before yield, checked after);
    // m2 was not reached.
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.kind).toBe("invalid-source-document");
    expect(persister.upserted.filter((e) => e.entityType === "member")).toHaveLength(0);
  });
});

describe("runImport — source.close() error suppression", () => {
  it("does not mask the result when source.close() throws", async () => {
    const source: ImportDataSource = {
      mode: "fake",
      listCollections() {
        return Promise.resolve([]);
      },
      async *iterate() {
        // yield nothing
      },
      close() {
        return Promise.reject(new Error("close failed"));
      },
    };
    const persister = createFakePersister();
    // The engine must swallow the close error and return the import result
    const result = await runImport({
      source,
      persister,
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
    });
    expect(result.outcome).toBe("completed");
    const closeWarning = result.warnings.find((w) => w.key === "source-close-error");
    expect(closeWarning?.message).toContain("close failed");
  });
});
