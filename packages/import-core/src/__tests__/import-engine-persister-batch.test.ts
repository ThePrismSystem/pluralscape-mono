/**
 * Import-engine persister tests — batch-mapper path.
 *
 * Covers: batch mapper persister invocation, abort during batch accumulation
 * and result processing, drop events in batch path, fatal/non-fatal persister
 * errors, and source iteration throws in the batch path.
 *
 * See also: import-engine-persister for the single-mapper path.
 *
 * Companion files: import-engine-parsing, import-engine-ordering,
 *                  import-engine-checkpoint, import-engine-error-classification,
 *                  import-engine-persister
 */

import { describe, expect, it } from "vitest";

import { runImportEngine } from "../import-engine.js";

import {
  noopProgress,
  createInMemoryPersister,
  mapped,
  skipped,
  failed,
  makeBatchSource,
  makeBatchDispatch,
  BATCH_DEPENDENCY_ORDER,
  batchCollectionToEntityType,
} from "./helpers/engine-fixtures.js";

import type { SourceDocument, BatchMapperOutput } from "../mapper-dispatch.js";
import type { SourceEvent, ImportDataSource } from "../source.types.js";

// ---------------------------------------------------------------------------
// Batch mapper basic persister invocation
// ---------------------------------------------------------------------------

describe("batch mapper", () => {
  it("processes all documents in a single batch call", async () => {
    // Uses makeBatchSource (items collection) + makeBatchDispatch (items key)
    const source = makeBatchSource([
      { _id: "m1", name: "Aria" },
      { _id: "m2", name: "Blake" },
      { _id: "m3", name: "Cass" },
    ]);

    let batchCallCount = 0;
    let receivedDocCount = 0;

    const batchDispatch = makeBatchDispatch((documents) => {
      batchCallCount += 1;
      receivedDocCount = documents.length;
      return documents.map((d) => ({
        sourceEntityId: d.sourceId,
        result: mapped(d.document),
      }));
    });

    const { persister, snapshot } = createInMemoryPersister();

    const result = await runImportEngine({
      source,
      persister,
      sourceFormat: "simply-plural",
      mapperDispatch: batchDispatch,
      dependencyOrder: BATCH_DEPENDENCY_ORDER,
      collectionToEntityType: batchCollectionToEntityType,
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
    });

    expect(result.outcome).toBe("completed");
    expect(batchCallCount).toBe(1);
    expect(receivedDocCount).toBe(3);

    const snap = snapshot();
    expect(snap.countByType("member")).toBe(3);
    expect(snap.find("member", "m1")?.sourceEntityId).toBe("m1");
    expect(snap.find("member", "m2")?.sourceEntityId).toBe("m2");
    expect(snap.find("member", "m3")?.sourceEntityId).toBe("m3");
  });

  it("handles batch mapper returning skipped and failed results", async () => {
    // Uses makeBatchSource (items collection) + makeBatchDispatch (items key)
    const source = makeBatchSource([
      { _id: "m1", name: "Aria" },
      { _id: "m2", name: "" },
      { _id: "m3", name: "Cass" },
    ]);

    const batchDispatch = makeBatchDispatch(
      (documents: readonly SourceDocument[]): readonly BatchMapperOutput[] => {
        return documents.map((d) => {
          const rec = d.document as Record<string, unknown>;
          if (rec["name"] === "") {
            return {
              sourceEntityId: d.sourceId,
              result: skipped({ kind: "empty-name", reason: "blank name" }),
            };
          }
          return { sourceEntityId: d.sourceId, result: mapped(d.document) };
        });
      },
    );

    const { persister, snapshot } = createInMemoryPersister();

    const result = await runImportEngine({
      source,
      persister,
      sourceFormat: "simply-plural",
      mapperDispatch: batchDispatch,
      dependencyOrder: BATCH_DEPENDENCY_ORDER,
      collectionToEntityType: batchCollectionToEntityType,
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
    });

    expect(result.outcome).toBe("completed");
    const snap = snapshot();
    expect(snap.countByType("member")).toBe(2);
    expect(result.finalState.totals.perCollection["member"]?.skipped).toBe(1);
  });
});

describe("batch mapper path", () => {
  it("persists entities via batch mapper", async () => {
    const source = makeBatchSource([
      { _id: "b1", name: "One" },
      { _id: "b2", name: "Two" },
    ]);
    const { persister, snapshot } = createInMemoryPersister();

    const result = await runImportEngine({
      source,
      persister,
      sourceFormat: "simply-plural",
      mapperDispatch: makeBatchDispatch((docs) =>
        docs.map((d) => ({ sourceEntityId: d.sourceId, result: mapped(d.document) })),
      ),
      dependencyOrder: BATCH_DEPENDENCY_ORDER,
      collectionToEntityType: batchCollectionToEntityType,
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
    });

    expect(result.outcome).toBe("completed");
    expect(snapshot().countByType("member")).toBe(2);
  });

  it("records skipped and failed results from batch mapper", async () => {
    const source = makeBatchSource([{ _id: "b1" }, { _id: "b2" }, { _id: "b3" }]);
    const { persister, snapshot } = createInMemoryPersister();

    const result = await runImportEngine({
      source,
      persister,
      sourceFormat: "simply-plural",
      mapperDispatch: makeBatchDispatch((docs) =>
        docs.map((d, i) => ({
          sourceEntityId: d.sourceId,
          result:
            i === 0
              ? mapped(d.document)
              : i === 1
                ? skipped({ kind: "empty-name", reason: "skip" })
                : failed({ kind: "validation-failed", message: "bad" }),
        })),
      ),
      dependencyOrder: BATCH_DEPENDENCY_ORDER,
      collectionToEntityType: batchCollectionToEntityType,
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
    });

    expect(result.outcome).toBe("completed");
    expect(snapshot().countByType("member")).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.message).toBe("bad");
  });

  it("handles drop events in batch path", async () => {
    const source: ImportDataSource = {
      mode: "fake",
      async *iterate(): AsyncGenerator<SourceEvent> {
        await Promise.resolve();
        yield { kind: "drop", collection: "items", sourceId: "d1", reason: "bad doc" };
        yield { kind: "doc", collection: "items", sourceId: "b1", document: { _id: "b1" } };
      },
      listCollections: () => Promise.resolve(["items"]),
      close: () => Promise.resolve(),
    };
    const { persister, snapshot } = createInMemoryPersister();

    const result = await runImportEngine({
      source,
      persister,
      sourceFormat: "simply-plural",
      mapperDispatch: makeBatchDispatch((docs) =>
        docs.map((d) => ({ sourceEntityId: d.sourceId, result: mapped(d.document) })),
      ),
      dependencyOrder: BATCH_DEPENDENCY_ORDER,
      collectionToEntityType: batchCollectionToEntityType,
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
    });

    expect(result.outcome).toBe("completed");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.kind).toBe("invalid-source-document");
    expect(snapshot().countByType("member")).toBe(1);
  });

  it("aborts on abort signal during batch accumulation", async () => {
    const controller = new AbortController();
    const source: ImportDataSource = {
      mode: "fake",
      async *iterate(): AsyncGenerator<SourceEvent> {
        await Promise.resolve();
        yield { kind: "doc", collection: "items", sourceId: "b1", document: { _id: "b1" } };
        controller.abort();
        yield { kind: "doc", collection: "items", sourceId: "b2", document: { _id: "b2" } };
      },
      listCollections: () => Promise.resolve(["items"]),
      close: () => Promise.resolve(),
    };
    const { persister } = createInMemoryPersister();

    const result = await runImportEngine({
      source,
      persister,
      sourceFormat: "simply-plural",
      mapperDispatch: makeBatchDispatch((docs) =>
        docs.map((d) => ({ sourceEntityId: d.sourceId, result: mapped(d.document) })),
      ),
      dependencyOrder: BATCH_DEPENDENCY_ORDER,
      collectionToEntityType: batchCollectionToEntityType,
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
      abortSignal: controller.signal,
    });

    expect(result.outcome).toBe("aborted");
  });

  it("aborts on abort signal during batch result processing", async () => {
    const controller = new AbortController();
    const source = makeBatchSource([{ _id: "b1" }, { _id: "b2" }]);
    const { persister } = createInMemoryPersister();
    let callCount = 0;

    const result = await runImportEngine({
      source,
      persister,
      sourceFormat: "simply-plural",
      mapperDispatch: makeBatchDispatch((docs) => {
        return docs.map((d) => {
          callCount += 1;
          if (callCount === 2) controller.abort();
          return { sourceEntityId: d.sourceId, result: mapped(d.document) };
        });
      }),
      dependencyOrder: BATCH_DEPENDENCY_ORDER,
      collectionToEntityType: batchCollectionToEntityType,
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
      abortSignal: controller.signal,
    });

    expect(result.outcome).toBe("aborted");
  });

  it("handles fatal persister error in batch path", async () => {
    const source = makeBatchSource([{ _id: "b1" }]);
    const { persister } = createInMemoryPersister({
      throwOn: [
        {
          entityType: "member",
          sourceEntityId: "b1",
          error: new SyntaxError("fatal"),
          fatal: true,
        },
      ],
    });

    const result = await runImportEngine({
      source,
      persister,
      sourceFormat: "simply-plural",
      mapperDispatch: makeBatchDispatch((docs) =>
        docs.map((d) => ({ sourceEntityId: d.sourceId, result: mapped(d.document) })),
      ),
      dependencyOrder: BATCH_DEPENDENCY_ORDER,
      collectionToEntityType: batchCollectionToEntityType,
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
    });

    expect(result.outcome).toBe("aborted");
    expect(result.errors[0]?.fatal).toBe(true);
  });

  it("source iteration throw in batch path produces fatal abort", async () => {
    const source: ImportDataSource = {
      mode: "fake",
      async *iterate(): AsyncGenerator<SourceEvent> {
        await Promise.resolve();
        yield { kind: "doc", collection: "items", sourceId: "b1", document: { _id: "b1" } };
        throw new Error("batch network error");
      },
      listCollections: () => Promise.resolve(["items"]),
      close: () => Promise.resolve(),
    };
    const { persister } = createInMemoryPersister();

    const result = await runImportEngine({
      source,
      persister,
      sourceFormat: "simply-plural",
      mapperDispatch: makeBatchDispatch((docs) =>
        docs.map((d) => ({ sourceEntityId: d.sourceId, result: mapped(d.document) })),
      ),
      dependencyOrder: BATCH_DEPENDENCY_ORDER,
      collectionToEntityType: batchCollectionToEntityType,
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
    });

    expect(result.outcome).toBe("aborted");
    expect(result.errors[0]?.fatal).toBe(true);
    expect(result.errors[0]?.message).toBe("batch network error");
  });

  it("handles non-fatal persister error in batch and continues", async () => {
    const source = makeBatchSource([{ _id: "b1" }, { _id: "b2" }]);
    const { persister, snapshot } = createInMemoryPersister({
      throwOn: [
        {
          entityType: "member",
          sourceEntityId: "b1",
          error: new Error("transient"),
          fatal: false,
          once: true,
        },
      ],
    });

    const result = await runImportEngine({
      source,
      persister,
      sourceFormat: "simply-plural",
      mapperDispatch: makeBatchDispatch((docs) =>
        docs.map((d) => ({ sourceEntityId: d.sourceId, result: mapped(d.document) })),
      ),
      dependencyOrder: BATCH_DEPENDENCY_ORDER,
      collectionToEntityType: batchCollectionToEntityType,
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
    });

    expect(result.outcome).toBe("completed");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.fatal).toBe(false);
    expect(snapshot().countByType("member")).toBe(1);
  });

  it("handles drop event with null sourceId in batch path", async () => {
    const source: ImportDataSource = {
      mode: "fake",
      async *iterate(): AsyncGenerator<SourceEvent> {
        await Promise.resolve();
        yield { kind: "drop", collection: "items", sourceId: null, reason: "no id" };
        yield { kind: "doc", collection: "items", sourceId: "b1", document: { _id: "b1" } };
      },
      listCollections: () => Promise.resolve(["items"]),
      close: () => Promise.resolve(),
    };
    const { persister, snapshot } = createInMemoryPersister();

    const result = await runImportEngine({
      source,
      persister,
      sourceFormat: "simply-plural",
      mapperDispatch: makeBatchDispatch((docs) =>
        docs.map((d) => ({ sourceEntityId: d.sourceId, result: mapped(d.document) })),
      ),
      dependencyOrder: BATCH_DEPENDENCY_ORDER,
      collectionToEntityType: batchCollectionToEntityType,
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
    });

    expect(result.outcome).toBe("completed");
    expect(result.errors).toHaveLength(1);
    expect(snapshot().countByType("member")).toBe(1);
  });
});
