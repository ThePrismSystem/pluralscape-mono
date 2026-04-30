/**
 * Import-engine checkpoint tests.
 *
 * Covers: checkpoint resume from mid-collection (single + batch paths),
 * resume with unknown entity type falling back to start,
 * stateRef propagation on fatal/non-fatal persister errors,
 * selectedCategories opt-out advancing checkpoint correctly,
 * and upsert action variants (idempotent re-import).
 *
 * Companion files: import-engine-parsing, import-engine-ordering,
 *                  import-engine-persister, import-engine-error-classification
 */

import { describe, expect, it } from "vitest";

import { emptyCheckpointState } from "../checkpoint.js";
import { runImportEngine } from "../import-engine.js";

import {
  SIMPLE_DEPENDENCY_ORDER,
  SIMPLE_COLLECTION_TO_ENTITY_TYPE,
  makeSimpleData,
  simpleMapperDispatch,
  noopProgress,
  createFakeImportSource,
  createInMemoryPersister,
  mapped,
  failed,
  makeBatchDispatch,
  passthroughBatchEntry,
  BATCH_DEPENDENCY_ORDER,
  batchCollectionToEntityType,
} from "./helpers/engine-fixtures.js";

import type { MapperDispatchEntry } from "../mapper-dispatch.js";
import type { SourceEvent, ImportDataSource } from "../source.types.js";
import type { ImportCheckpointState } from "@pluralscape/types";

describe("resume from checkpoint", () => {
  it("resumes mid-collection from a prior checkpoint", async () => {
    const data = {
      members: [
        { _id: "m1", name: "Aria" },
        { _id: "m2", name: "Blake" },
        { _id: "m3", name: "Cass" },
        { _id: "m4", name: "Drew" },
      ],
    };

    const controller = new AbortController();
    let processed = 0;

    const abortAfterTwoDispatch: Readonly<Record<string, MapperDispatchEntry>> = {
      members: {
        entityType: "member",
        map: (doc: unknown) => {
          processed += 1;
          if (processed >= 2) {
            controller.abort();
          }
          return mapped(doc);
        },
      },
    };

    const source1 = createFakeImportSource(data);
    const { persister: persister1 } = createInMemoryPersister();

    // Run 1: abort after 2 docs
    const run1Result = await runImportEngine({
      source: source1,
      persister: persister1,
      sourceFormat: "simply-plural",
      mapperDispatch: abortAfterTwoDispatch,
      dependencyOrder: ["members"],
      collectionToEntityType: () => "member",
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
      abortSignal: controller.signal,
    });

    expect(run1Result.outcome).toBe("aborted");
    const checkpoint = run1Result.finalState;
    expect(checkpoint.checkpoint.currentCollectionLastSourceId).toBe("m2");

    // Run 2: resume from checkpoint
    const source2 = createFakeImportSource(data);
    const { persister: persister2, snapshot: snapshot2 } = createInMemoryPersister();

    const run2Result = await runImportEngine({
      source: source2,
      persister: persister2,
      sourceFormat: "simply-plural",
      mapperDispatch: {
        members: {
          entityType: "member",
          map: (doc: unknown) => mapped(doc),
        },
      },
      dependencyOrder: ["members"],
      collectionToEntityType: () => "member",
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
      initialCheckpoint: checkpoint,
    });

    expect(run2Result.outcome).toBe("completed");

    const snap = snapshot2();
    // Only docs after the cutoff should be persisted (m3, m4)
    expect(snap.countByType("member")).toBe(2);
    expect(snap.find("member", "m3")?.sourceEntityId).toBe("m3");
    expect(snap.find("member", "m4")?.sourceEntityId).toBe("m4");
    // m1 and m2 were processed in the first run, not here
    expect(snap.find("member", "m1")).toBeUndefined();
    expect(snap.find("member", "m2")).toBeUndefined();
  });
});

describe("resume with unknown entity type falls back to start", () => {
  it("starts from index 0 when checkpoint entity type is not in dependency order", async () => {
    const source = createFakeImportSource(makeSimpleData());
    const { persister, snapshot } = createInMemoryPersister();

    // Create a checkpoint that references a collection type not in the dependency order
    const initialCheckpoint = emptyCheckpointState({
      firstEntityType: "fronting-session", // not in SIMPLE_DEPENDENCY_ORDER
      selectedCategories: {},
      avatarMode: "skip",
    });

    const result = await runImportEngine({
      source,
      persister,
      sourceFormat: "simply-plural",
      mapperDispatch: simpleMapperDispatch,
      dependencyOrder: SIMPLE_DEPENDENCY_ORDER,
      collectionToEntityType: SIMPLE_COLLECTION_TO_ENTITY_TYPE,
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
      initialCheckpoint,
    });

    // Should fall back to index 0 and process everything
    expect(result.outcome).toBe("completed");
    expect(snapshot().countByType("member")).toBe(2);
    expect(snapshot().countByType("group")).toBe(2);
  });
});

describe("batch mapper resume from checkpoint", () => {
  it("skips documents before the resume cutoff in batch path", async () => {
    // Use a drop event to create a checkpoint mid-collection, since drops
    // advance lastSourceId during batch accumulation (unlike abort which
    // returns immediately without advancing).
    const source1: ImportDataSource = {
      mode: "fake",
      async *iterate(): AsyncGenerator<SourceEvent> {
        await Promise.resolve();
        yield { kind: "drop", collection: "items", sourceId: "b1", reason: "bad" };
        yield { kind: "doc", collection: "items", sourceId: "b2", document: { _id: "b2" } };
      },
      listCollections: () => Promise.resolve(["items"]),
      close: () => Promise.resolve(),
    };
    const { persister: persister1 } = createInMemoryPersister();

    const run1Result = await runImportEngine({
      source: source1,
      persister: persister1,
      sourceFormat: "simply-plural",
      mapperDispatch: { items: passthroughBatchEntry },
      dependencyOrder: BATCH_DEPENDENCY_ORDER,
      collectionToEntityType: batchCollectionToEntityType,
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
    });

    // First run completes — b1 dropped, b2 persisted. Now build a
    // checkpoint that says we left off at b2 mid-collection.
    expect(run1Result.outcome).toBe("completed");

    // Simulate a checkpoint mid-collection pointing at b2 as the cutoff.
    // We need currentCollection === entityType AND lastSourceId set.
    const baseState = emptyCheckpointState({
      firstEntityType: "member",
      selectedCategories: {},
      avatarMode: "skip",
    });
    const resumeCheckpoint: ImportCheckpointState = {
      ...baseState,
      checkpoint: {
        ...baseState.checkpoint,
        currentCollection: "member",
        currentCollectionLastSourceId: "b2",
      },
    };

    // Second run: resume from the fabricated checkpoint
    const source2: ImportDataSource = {
      mode: "fake",
      async *iterate(): AsyncGenerator<SourceEvent> {
        await Promise.resolve();
        yield { kind: "doc", collection: "items", sourceId: "b1", document: { _id: "b1" } };
        yield { kind: "doc", collection: "items", sourceId: "b2", document: { _id: "b2" } };
        yield { kind: "doc", collection: "items", sourceId: "b3", document: { _id: "b3" } };
        yield { kind: "doc", collection: "items", sourceId: "b4", document: { _id: "b4" } };
      },
      listCollections: () => Promise.resolve(["items"]),
      close: () => Promise.resolve(),
    };
    const { persister: persister2, snapshot: snapshot2 } = createInMemoryPersister();

    const run2Result = await runImportEngine({
      source: source2,
      persister: persister2,
      sourceFormat: "simply-plural",
      mapperDispatch: { items: passthroughBatchEntry },
      dependencyOrder: BATCH_DEPENDENCY_ORDER,
      collectionToEntityType: batchCollectionToEntityType,
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
      initialCheckpoint: resumeCheckpoint,
    });

    expect(run2Result.outcome).toBe("completed");
    const snap = snapshot2();
    // b1 and b2 should be skipped (before/at the cutoff)
    expect(snap.find("member", "b1")).toBeUndefined();
    expect(snap.find("member", "b2")).toBeUndefined();
    // b3 and b4 should be persisted (after the cutoff)
    expect(snap.find("member", "b3")?.sourceEntityId).toBe("b3");
    expect(snap.find("member", "b4")?.sourceEntityId).toBe("b4");
  });
});

describe("persistMapperResult stateRef propagation", () => {
  it("returns aborted result with correct checkpoint state on fatal persister error", async () => {
    const source = createFakeImportSource({
      members: [
        { _id: "m1", name: "Aria" },
        { _id: "m2", name: "Blake" },
        { _id: "m3", name: "Cass" },
      ],
    });
    const { persister } = createInMemoryPersister({
      throwOn: [
        {
          entityType: "member",
          sourceEntityId: "m2",
          error: new SyntaxError("fatal write"),
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
    // Checkpoint should reflect m1 imported; m2 fatal abort exits before
    // advancing the checkpoint, so the fatal entity is not counted in totals.
    expect(result.finalState.totals.perCollection["member"]?.imported).toBe(1);
    expect(result.finalState.totals.perCollection["member"]?.total).toBe(1);
    // The fatal error is still recorded in the errors array
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.fatal).toBe(true);
  });

  it("reflects failure delta in checkpoint state for non-fatal mapper failed status", async () => {
    const source = createFakeImportSource({
      members: [
        { _id: "m1", name: "Aria" },
        { _id: "m2", name: "" },
        { _id: "m3", name: "Cass" },
      ],
    });
    const { persister } = createInMemoryPersister();

    const result = await runImportEngine({
      source,
      persister,
      sourceFormat: "simply-plural",
      mapperDispatch: {
        members: {
          entityType: "member",
          map: (doc: unknown) => {
            const record = doc as Record<string, unknown>;
            if (!record["name"])
              return failed({ kind: "validation-failed", message: "empty name" });
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
    // Checkpoint should reflect 2 imported + 1 failed
    expect(result.finalState.totals.perCollection["member"]?.imported).toBe(2);
    expect(result.finalState.totals.perCollection["member"]?.failed).toBe(1);
    expect(result.finalState.totals.perCollection["member"]?.total).toBe(3);
    // The failure should be recorded
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.entityId).toBe("m2");
  });
});

describe("selectedCategories opt-out advances checkpoint for non-last collection", () => {
  it("marks opted-out first collection as completed and processes the second", async () => {
    const source = createFakeImportSource(makeSimpleData());
    const { persister, snapshot } = createInMemoryPersister();
    const progressStates: ImportCheckpointState[] = [];

    const result = await runImportEngine({
      source,
      persister,
      sourceFormat: "simply-plural",
      mapperDispatch: simpleMapperDispatch,
      dependencyOrder: SIMPLE_DEPENDENCY_ORDER,
      collectionToEntityType: SIMPLE_COLLECTION_TO_ENTITY_TYPE,
      options: { selectedCategories: { member: false }, avatarMode: "skip" },
      onProgress: (state) => {
        progressStates.push(state);
        return Promise.resolve();
      },
    });

    expect(result.outcome).toBe("completed");
    // Members were skipped entirely
    expect(snapshot().countByType("member")).toBe(0);
    // Groups should have been processed (but FK misses will fail them)
    expect(result.finalState.checkpoint.completedCollections).toContain("member");
    expect(result.finalState.checkpoint.completedCollections).toContain("group");
    // onProgress called at least once for the skipped collection
    expect(progressStates.length).toBeGreaterThanOrEqual(1);
  });
});

describe("batch mapper upsert actions (updated, skipped)", () => {
  it("handles updated and skipped upsert actions in batch path", async () => {
    const docs = [
      { _id: "b1", name: "One" },
      { _id: "b2", name: "Two" },
    ];
    const dispatch = makeBatchDispatch((d) =>
      d.map((doc) => ({ sourceEntityId: doc.sourceId, result: mapped(doc.document) })),
    );

    const { persister, snapshot } = createInMemoryPersister();

    // First run: all created
    const source1 = {
      mode: "fake" as const,
      async *iterate(): AsyncGenerator<SourceEvent> {
        await Promise.resolve();
        for (const doc of docs) {
          yield {
            kind: "doc" as const,
            collection: "items",
            sourceId: doc._id,
            document: doc,
          };
        }
      },
      listCollections: () => Promise.resolve(["items"]),
      close: () => Promise.resolve(),
    };

    await runImportEngine({
      source: source1,
      persister,
      sourceFormat: "simply-plural",
      mapperDispatch: dispatch,
      dependencyOrder: BATCH_DEPENDENCY_ORDER,
      collectionToEntityType: batchCollectionToEntityType,
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
    });
    expect(snapshot().countByType("member")).toBe(2);

    // Second run with same data: upserts return "skipped" (content identical)
    const source2 = {
      mode: "fake" as const,
      async *iterate(): AsyncGenerator<SourceEvent> {
        await Promise.resolve();
        for (const doc of docs) {
          yield {
            kind: "doc" as const,
            collection: "items",
            sourceId: doc._id,
            document: doc,
          };
        }
      },
      listCollections: () => Promise.resolve(["items"]),
      close: () => Promise.resolve(),
    };
    const run2Result = await runImportEngine({
      source: source2,
      persister,
      sourceFormat: "simply-plural",
      mapperDispatch: dispatch,
      dependencyOrder: BATCH_DEPENDENCY_ORDER,
      collectionToEntityType: batchCollectionToEntityType,
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
    });
    expect(run2Result.outcome).toBe("completed");

    // Third run with different data: upserts return "updated"
    const updatedDocs = [
      { _id: "b1", name: "Updated" },
      { _id: "b2", name: "Changed" },
    ];
    const source3 = {
      mode: "fake" as const,
      async *iterate(): AsyncGenerator<SourceEvent> {
        await Promise.resolve();
        for (const doc of updatedDocs) {
          yield {
            kind: "doc" as const,
            collection: "items",
            sourceId: doc._id,
            document: doc,
          };
        }
      },
      listCollections: () => Promise.resolve(["items"]),
      close: () => Promise.resolve(),
    };
    const run3Result = await runImportEngine({
      source: source3,
      persister,
      sourceFormat: "simply-plural",
      mapperDispatch: dispatch,
      dependencyOrder: BATCH_DEPENDENCY_ORDER,
      collectionToEntityType: batchCollectionToEntityType,
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
    });
    expect(run3Result.outcome).toBe("completed");
    expect(snapshot().countByType("member")).toBe(2);
  });
});

describe("upsert action variants in single mapper", () => {
  it("handles 'updated' upsert action on re-import", async () => {
    const data = makeSimpleData();
    const source1 = createFakeImportSource(data);
    const { persister, snapshot } = createInMemoryPersister();

    // First import: all entities are "created"
    await runImportEngine({
      source: source1,
      persister,
      sourceFormat: "simply-plural",
      mapperDispatch: simpleMapperDispatch,
      dependencyOrder: SIMPLE_DEPENDENCY_ORDER,
      collectionToEntityType: SIMPLE_COLLECTION_TO_ENTITY_TYPE,
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
    });
    expect(snapshot().countByType("member")).toBe(2);

    // Second import with same data: entities become "updated" or "skipped"
    const source2 = createFakeImportSource(data);
    const run2Result = await runImportEngine({
      source: source2,
      persister,
      sourceFormat: "simply-plural",
      mapperDispatch: simpleMapperDispatch,
      dependencyOrder: SIMPLE_DEPENDENCY_ORDER,
      collectionToEntityType: SIMPLE_COLLECTION_TO_ENTITY_TYPE,
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
    });

    expect(run2Result.outcome).toBe("completed");
    // Entities still exist (no duplicates)
    expect(snapshot().countByType("member")).toBe(2);
  });
});
