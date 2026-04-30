/**
 * Import-engine error classification tests.
 *
 * Covers: non-fatal vs fatal error classification, custom classifyError
 * injection (single + batch paths), source iteration throws overriding
 * non-fatal classifiers to fatal, and fatal persister errors in single mapper.
 *
 * Companion files: import-engine-parsing, import-engine-ordering,
 *                  import-engine-checkpoint, import-engine-persister
 */

import { describe, expect, it } from "vitest";

import { runImportEngine } from "../import-engine.js";
import {
  makeSimpleData,
  simpleMapperDispatch,
  noopProgress,
  createFakeImportSource,
  createInMemoryPersister,
  mapped,
  failed,
  makeBatchDispatch,
  BATCH_DEPENDENCY_ORDER,
  batchCollectionToEntityType,
  passthroughBatchEntry,
} from "./helpers/engine-fixtures.js";

import type { BatchMapperEntry, SourceDocument, BatchMapperOutput } from "../mapper-dispatch.js";
import type { SourceEvent, ImportDataSource } from "../source.types.js";

// ---------------------------------------------------------------------------
// Error classification (non-fatal mapper errors)
// ---------------------------------------------------------------------------

describe("error classification", () => {
  it("records non-fatal mapper errors and continues", async () => {
    const data = {
      members: [
        { _id: "m1", name: "Aria" },
        { _id: "m2", name: "Blake" },
        { _id: "m3", name: "Cass" },
      ],
    };

    const source = createFakeImportSource(data);
    const { persister, snapshot } = createInMemoryPersister();

    const result = await runImportEngine({
      source,
      persister,
      sourceFormat: "simply-plural",
      mapperDispatch: {
        members: {
          entityType: "member",
          map: (doc: unknown) => {
            const record = doc as Record<string, unknown>;
            if (record["_id"] === "m2") {
              return failed({ kind: "validation-failed", message: "bad data" });
            }
            return mapped(doc);
          },
        },
      },
      dependencyOrder: ["members"],
      collectionToEntityType: () => "member",
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
    });

    expect(result.outcome).toBe("completed");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.entityId).toBe("m2");
    expect(result.errors[0]?.fatal).toBe(false);

    const snap = snapshot();
    // m1 and m3 persisted, m2 failed
    expect(snap.countByType("member")).toBe(2);
    expect(snap.find("member", "m1")?.sourceEntityId).toBe("m1");
    expect(snap.find("member", "m3")?.sourceEntityId).toBe("m3");
    expect(snap.find("member", "m2")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Custom classifyError injection
// ---------------------------------------------------------------------------

describe("custom classifyError injection", () => {
  it("aborts when classifyError marks all errors as fatal", async () => {
    const source = createFakeImportSource({
      members: [
        { _id: "m1", name: "Aria" },
        { _id: "m2", name: "Blake" },
      ],
    });
    const { persister, snapshot } = createInMemoryPersister({
      throwOn: [
        {
          entityType: "member",
          sourceEntityId: "m1",
          error: new Error("transient db error"),
          fatal: false,
          once: true,
        },
      ],
    });

    const result = await runImportEngine({
      source,
      persister,
      sourceFormat: "simply-plural",
      mapperDispatch: {
        members: { entityType: "member", map: (doc: unknown) => mapped(doc) },
      },
      dependencyOrder: ["members"],
      collectionToEntityType: () => "member",
      classifyError: (thrown, ctx) => ({
        entityType: ctx.entityType,
        entityId: ctx.entityId,
        message: thrown instanceof Error ? thrown.message : String(thrown),
        fatal: true,
        recoverable: false,
      }),
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
    });

    expect(result.outcome).toBe("aborted");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.fatal).toBe(true);
    expect(result.errors[0]?.message).toBe("transient db error");
    // m1 failed fatally, m2 never reached
    expect(snapshot().countByType("member")).toBe(0);
  });

  it("aborts batch path when classifyError marks persister error as fatal", async () => {
    const batchEntry: BatchMapperEntry = {
      entityType: "member",
      batch: true,
      mapBatch: (documents: readonly SourceDocument[]): readonly BatchMapperOutput[] =>
        documents.map((d) => ({ sourceEntityId: d.sourceId, result: mapped(d.document) })),
    };

    const source: ImportDataSource = {
      mode: "fake",
      async *iterate(): AsyncGenerator<SourceEvent> {
        await Promise.resolve();
        yield { kind: "doc", collection: "items", sourceId: "b1", document: { _id: "b1" } };
        yield { kind: "doc", collection: "items", sourceId: "b2", document: { _id: "b2" } };
      },
      listCollections: () => Promise.resolve(["items"]),
      close: () => Promise.resolve(),
    };
    const { persister, snapshot } = createInMemoryPersister({
      throwOn: [
        {
          entityType: "member",
          sourceEntityId: "b1",
          error: new Error("db down"),
          fatal: false,
          once: true,
        },
      ],
    });

    const result = await runImportEngine({
      source,
      persister,
      sourceFormat: "simply-plural",
      mapperDispatch: { items: batchEntry },
      dependencyOrder: BATCH_DEPENDENCY_ORDER,
      collectionToEntityType: batchCollectionToEntityType,
      classifyError: (thrown, ctx) => ({
        entityType: ctx.entityType,
        entityId: ctx.entityId,
        message: thrown instanceof Error ? thrown.message : String(thrown),
        fatal: true,
        recoverable: false,
      }),
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
    });

    expect(result.outcome).toBe("aborted");
    expect(result.errors[0]?.fatal).toBe(true);
    expect(snapshot().countByType("member")).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Fatal persister error in single mapper via default classifier
// ---------------------------------------------------------------------------

describe("fatal persister error in single mapper", () => {
  it("aborts when persister throws and classifyError returns fatal", async () => {
    const source = createFakeImportSource({
      members: [
        { _id: "m1", name: "Aria" },
        { _id: "m2", name: "Blake" },
        { _id: "m3", name: "Cass" },
      ],
    });
    // Use SyntaxError which the default classifier treats as fatal
    const { persister, snapshot } = createInMemoryPersister({
      throwOn: [
        {
          entityType: "member",
          sourceEntityId: "m2",
          error: new SyntaxError("corrupt payload"),
          fatal: true,
        },
      ],
    });

    const result = await runImportEngine({
      source,
      persister,
      sourceFormat: "simply-plural",
      mapperDispatch: {
        members: { entityType: "member", map: (doc: unknown) => mapped(doc) },
      },
      dependencyOrder: ["members"],
      collectionToEntityType: () => "member",
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
    });

    expect(result.outcome).toBe("aborted");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.fatal).toBe(true);
    expect(result.errors[0]?.message).toBe("corrupt payload");
    // m1 succeeded, m2 was fatal, m3 never reached
    expect(snapshot().countByType("member")).toBe(1);
    expect(snapshot().find("member", "m1")?.sourceEntityId).toBe("m1");
  });
});

// ---------------------------------------------------------------------------
// Source iteration throw with non-fatal classifier override
// ---------------------------------------------------------------------------

describe("source iteration throw with non-fatal classifier override", () => {
  it("forces fatal:true even when classifyError returns non-fatal for iteration throw", async () => {
    const source: ImportDataSource = {
      mode: "fake",
      async *iterate(): AsyncGenerator<SourceEvent> {
        await Promise.resolve();
        throw new Error("network down");
      },
      listCollections: () => Promise.resolve(["members"]),
      close: () => Promise.resolve(),
    };
    const { persister } = createInMemoryPersister();

    const result = await runImportEngine({
      source,
      persister,
      sourceFormat: "simply-plural",
      mapperDispatch: {
        members: { entityType: "member", map: (doc: unknown) => mapped(doc) },
      },
      dependencyOrder: ["members"],
      collectionToEntityType: () => "member",
      // Classifier that always returns non-fatal — engine should override
      classifyError: (thrown, ctx) => ({
        entityType: ctx.entityType,
        entityId: ctx.entityId,
        message: thrown instanceof Error ? thrown.message : String(thrown),
        fatal: false,
      }),
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
    });

    expect(result.outcome).toBe("aborted");
    expect(result.errors).toHaveLength(1);
    // The engine must override the classifier to make iteration throws fatal
    expect(result.errors[0]?.fatal).toBe(true);
    expect(result.errors[0]?.message).toBe("network down");
  });

  it("forces fatal:true for batch path iteration throw even when classifier says non-fatal", async () => {
    const batchEntry: BatchMapperEntry = {
      entityType: "member",
      batch: true,
      mapBatch: (documents: readonly SourceDocument[]): readonly BatchMapperOutput[] =>
        documents.map((d) => ({ sourceEntityId: d.sourceId, result: mapped(d.document) })),
    };

    const source: ImportDataSource = {
      mode: "fake",
      async *iterate(): AsyncGenerator<SourceEvent> {
        await Promise.resolve();
        throw new Error("batch network down");
      },
      listCollections: () => Promise.resolve(["items"]),
      close: () => Promise.resolve(),
    };
    const { persister } = createInMemoryPersister();

    const result = await runImportEngine({
      source,
      persister,
      sourceFormat: "simply-plural",
      mapperDispatch: { items: batchEntry },
      dependencyOrder: BATCH_DEPENDENCY_ORDER,
      collectionToEntityType: batchCollectionToEntityType,
      classifyError: (thrown, ctx) => ({
        entityType: ctx.entityType,
        entityId: ctx.entityId,
        message: thrown instanceof Error ? thrown.message : String(thrown),
        fatal: false,
      }),
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
    });

    expect(result.outcome).toBe("aborted");
    expect(result.errors[0]?.fatal).toBe(true);
    expect(result.errors[0]?.message).toBe("batch network down");
    // Should have recoverable flag since classifier returned non-fatal
    const error = result.errors[0];
    if (error && "recoverable" in error) {
      expect(error["recoverable"]).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// simpleMapperDispatch smoke-test with FK failures
// ---------------------------------------------------------------------------

describe("error classification via FK miss in simpleMapperDispatch", () => {
  it("classifies FK-miss as non-fatal and continues", async () => {
    const data = {
      members: [],
      groups: [{ _id: "g1", label: "Orphan", memberRef: "missing-member" }],
    };

    const source = createFakeImportSource(data);
    const { persister } = createInMemoryPersister();

    const result = await runImportEngine({
      source,
      persister,
      sourceFormat: "simply-plural",
      mapperDispatch: simpleMapperDispatch,
      dependencyOrder: ["members", "groups"],
      collectionToEntityType: (c: string) =>
        c === "members" ? "member" : "group",
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
    });

    expect(result.outcome).toBe("completed");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.kind).toBe("fk-miss");
    expect(result.errors[0]?.fatal).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// passthroughBatchEntry re-use check (smoke test)
// ---------------------------------------------------------------------------

describe("passthroughBatchEntry shared fixture", () => {
  it("persists all docs without modification", async () => {
    const source: ImportDataSource = {
      mode: "fake",
      async *iterate(): AsyncGenerator<SourceEvent> {
        await Promise.resolve();
        yield { kind: "doc", collection: "items", sourceId: "x1", document: { _id: "x1" } };
        yield { kind: "doc", collection: "items", sourceId: "x2", document: { _id: "x2" } };
      },
      listCollections: () => Promise.resolve(["items"]),
      close: () => Promise.resolve(),
    };
    const { persister, snapshot } = createInMemoryPersister();

    const result = await runImportEngine({
      source,
      persister,
      sourceFormat: "simply-plural",
      mapperDispatch: { items: passthroughBatchEntry },
      dependencyOrder: BATCH_DEPENDENCY_ORDER,
      collectionToEntityType: batchCollectionToEntityType,
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
    });

    expect(result.outcome).toBe("completed");
    expect(snapshot().countByType("member")).toBe(2);
  });
});
