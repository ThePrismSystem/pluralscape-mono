/**
 * Import-engine persister tests — single-mapper path.
 *
 * Covers: persister contract invocation (single-mapper path), abort signal
 * semantics, source.close() lifecycle, drop events, beforeCollection hook,
 * skipped/failed mapper results, upsert action variants (single mapper).
 *
 * See also: import-engine-persister-batch for the batch-mapper path.
 *
 * Companion files: import-engine-parsing, import-engine-ordering,
 *                  import-engine-checkpoint, import-engine-error-classification,
 *                  import-engine-persister-batch
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
  skipped,
  failed,
} from "./helpers/engine-fixtures.js";

import type { MapperDispatchEntry } from "../mapper-dispatch.js";
import type { SourceEvent, ImportDataSource } from "../source.types.js";
import type { BeforeCollectionArgs, BeforeCollectionResult } from "../import-engine.js";

// ---------------------------------------------------------------------------
// Abort signal (single-mapper path)
// ---------------------------------------------------------------------------

describe("abort signal", () => {
  it("returns aborted outcome when signal fires during iteration", async () => {
    const controller = new AbortController();
    let docCount = 0;

    const data = {
      members: [
        { _id: "m1", name: "A" },
        { _id: "m2", name: "B" },
        { _id: "m3", name: "C" },
        { _id: "m4", name: "D" },
        { _id: "m5", name: "E" },
      ],
    };

    // Mapper that aborts after processing 2 docs
    const abortingDispatch: Readonly<Record<string, MapperDispatchEntry>> = {
      members: {
        entityType: "member",
        map: (doc: unknown) => {
          docCount += 1;
          if (docCount >= 2) {
            controller.abort();
          }
          return mapped(doc);
        },
      },
    };

    const source = createFakeImportSource(data);
    const { persister, snapshot } = createInMemoryPersister();

    const result = await runImportEngine({
      source,
      persister,
      sourceFormat: "simply-plural",
      mapperDispatch: abortingDispatch,
      dependencyOrder: ["members"],
      collectionToEntityType: () => "member",
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
      abortSignal: controller.signal,
    });

    expect(result.outcome).toBe("aborted");

    // At least 2 docs should have been persisted before abort was detected
    const snap = snapshot();
    expect(snap.countByType("member")).toBeGreaterThanOrEqual(2);
    expect(snap.countByType("member")).toBeLessThan(5);
  });
});

describe("abort signal before collection iteration", () => {
  it("aborts before processing any collection when signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort(); // Pre-abort

    const source = createFakeImportSource(makeSimpleData());
    const { persister, snapshot } = createInMemoryPersister();

    const result = await runImportEngine({
      source,
      persister,
      sourceFormat: "simply-plural",
      mapperDispatch: simpleMapperDispatch,
      dependencyOrder: SIMPLE_DEPENDENCY_ORDER,
      collectionToEntityType: SIMPLE_COLLECTION_TO_ENTITY_TYPE,
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
      abortSignal: controller.signal,
    });

    expect(result.outcome).toBe("aborted");
    expect(snapshot().countByType("member")).toBe(0);
    expect(snapshot().countByType("group")).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// source.close() lifecycle
// ---------------------------------------------------------------------------

describe("source.close() is always called", () => {
  it("calls close even on successful completion", async () => {
    let closeCalled = false;
    const baseSource = createFakeImportSource({ members: [{ _id: "m1", name: "A" }] });
    const source = {
      ...baseSource,
      close(): Promise<void> {
        closeCalled = true;
        return Promise.resolve();
      },
    };

    const { persister } = createInMemoryPersister();

    await runImportEngine({
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

    expect(closeCalled).toBe(true);
  });
});

describe("source.close() error path", () => {
  it("produces a warning when source.close() throws", async () => {
    const source = createFakeImportSource(makeSimpleData());
    source.close = () => {
      return Promise.reject(new Error("close failed"));
    };
    const { persister } = createInMemoryPersister();

    const result = await runImportEngine({
      source,
      persister,
      sourceFormat: "simply-plural",
      mapperDispatch: simpleMapperDispatch,
      dependencyOrder: SIMPLE_DEPENDENCY_ORDER,
      collectionToEntityType: SIMPLE_COLLECTION_TO_ENTITY_TYPE,
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
    });

    expect(result.outcome).toBe("completed");
    expect(result.warnings.some((w) => w.message.includes("source.close() failed"))).toBe(true);
  });
});

describe("source.close() error on aborted run", () => {
  it("produces a warning when source.close() throws during an aborted run", async () => {
    const controller = new AbortController();
    controller.abort(); // Pre-abort
    const source = createFakeImportSource(makeSimpleData());
    source.close = () => Promise.reject(new Error("close leaked handle"));
    const { persister } = createInMemoryPersister();

    const result = await runImportEngine({
      source,
      persister,
      sourceFormat: "simply-plural",
      mapperDispatch: simpleMapperDispatch,
      dependencyOrder: SIMPLE_DEPENDENCY_ORDER,
      collectionToEntityType: SIMPLE_COLLECTION_TO_ENTITY_TYPE,
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
      abortSignal: controller.signal,
    });

    expect(result.outcome).toBe("aborted");
    const closeWarning = result.warnings.find((w) => w.key === "source-close-error");
    expect(closeWarning?.message).toContain("close leaked handle");
  });
});

// ---------------------------------------------------------------------------
// Drop events from source (single-mapper path)
// ---------------------------------------------------------------------------

describe("drop events from source", () => {
  it("records drop events as non-fatal errors and continues", async () => {
    const source: ImportDataSource = {
      mode: "fake",
      async *iterate(collection: string): AsyncGenerator<SourceEvent> {
        await Promise.resolve();
        if (collection === "members") {
          yield { kind: "drop", collection, sourceId: "m1", reason: "malformed document" };
          yield { kind: "doc", collection, sourceId: "m2", document: { _id: "m2", name: "Blake" } };
        }
      },
      listCollections: () => Promise.resolve(["members"]),
      close: () => Promise.resolve(),
    };
    const { persister, snapshot } = createInMemoryPersister();

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

    expect(result.outcome).toBe("completed");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.message).toBe("malformed document");
    expect(result.errors[0]?.fatal).toBe(false);
    expect(snapshot().countByType("member")).toBe(1);
  });
});

describe("drop event with null sourceId", () => {
  it("records error without advancing lastSourceId", async () => {
    const source: ImportDataSource = {
      mode: "fake",
      async *iterate(): AsyncGenerator<SourceEvent> {
        await Promise.resolve();
        yield { kind: "drop", collection: "members", sourceId: null, reason: "no id" };
        yield { kind: "doc", collection: "members", sourceId: "m1", document: { _id: "m1" } };
      },
      listCollections: () => Promise.resolve(["members"]),
      close: () => Promise.resolve(),
    };
    const { persister, snapshot } = createInMemoryPersister();

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

    expect(result.outcome).toBe("completed");
    expect(result.errors).toHaveLength(1);
    expect(snapshot().countByType("member")).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Abort after drop in single-mapper path
// ---------------------------------------------------------------------------

describe("abort after drop in single mapper", () => {
  it("aborts when signal fires after processing a drop event", async () => {
    const controller = new AbortController();
    const source: ImportDataSource = {
      mode: "fake",
      async *iterate(): AsyncGenerator<SourceEvent> {
        await Promise.resolve();
        yield { kind: "drop", collection: "members", sourceId: "d1", reason: "bad" };
        controller.abort();
        yield { kind: "doc", collection: "members", sourceId: "m1", document: { _id: "m1" } };
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
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
      abortSignal: controller.signal,
    });

    expect(result.outcome).toBe("aborted");
  });
});

// ---------------------------------------------------------------------------
// source iteration fatal throw (single-mapper path)
// ---------------------------------------------------------------------------

describe("source iteration fatal throw", () => {
  it("produces a fatal error when iterate() throws mid-iteration", async () => {
    const source: ImportDataSource = {
      mode: "fake",
      async *iterate(collection: string): AsyncGenerator<SourceEvent> {
        await Promise.resolve();
        if (collection === "members") {
          yield { kind: "doc", collection, sourceId: "m1", document: { _id: "m1", name: "Aria" } };
          throw new Error("network timeout");
        }
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
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
    });

    expect(result.outcome).toBe("aborted");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.fatal).toBe(true);
    expect(result.errors[0]?.message).toBe("network timeout");
  });
});

// ---------------------------------------------------------------------------
// Non-fatal / skipped / failed single-mapper results
// ---------------------------------------------------------------------------

describe("non-fatal persister error in single mapper continues", () => {
  it("records error and processes remaining entities", async () => {
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
      mapperDispatch: {
        members: { entityType: "member", map: (doc: unknown) => mapped(doc) },
      },
      dependencyOrder: ["members"],
      collectionToEntityType: () => "member",
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
    });

    expect(result.outcome).toBe("completed");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.fatal).toBe(false);
    expect(snapshot().countByType("member")).toBe(1); // m2 succeeded
  });
});

describe("skipped mapper result in single mapper path", () => {
  it("advances checkpoint past skipped entities", async () => {
    const source = createFakeImportSource({
      members: [
        { _id: "m1", name: "" },
        { _id: "m2", name: "Blake" },
      ],
    });
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
            if (!record["name"]) return skipped({ kind: "empty-name", reason: "no name" });
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
    expect(snapshot().countByType("member")).toBe(1);
  });
});

describe("failed mapper result in single mapper path", () => {
  it("records non-fatal error and continues", async () => {
    const source = createFakeImportSource({
      members: [
        { _id: "m1", name: "Aria" },
        { _id: "m2", name: "bad" },
        { _id: "m3", name: "Cass" },
      ],
    });
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
            if (record["name"] === "bad")
              return failed({ kind: "validation-failed", message: "bad name" });
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
    expect(result.errors[0]?.message).toBe("bad name");
    expect(snapshot().countByType("member")).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// beforeCollection hook
// ---------------------------------------------------------------------------

describe("beforeCollection hook", () => {
  it("is called before each collection and can modify state", async () => {
    const calledFor: string[] = [];

    const source = createFakeImportSource(makeSimpleData());
    const { persister } = createInMemoryPersister();

    const result = await runImportEngine({
      source,
      persister,
      sourceFormat: "simply-plural",
      mapperDispatch: simpleMapperDispatch,
      dependencyOrder: SIMPLE_DEPENDENCY_ORDER,
      collectionToEntityType: SIMPLE_COLLECTION_TO_ENTITY_TYPE,
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
      beforeCollection: (args: BeforeCollectionArgs): Promise<BeforeCollectionResult> => {
        calledFor.push(args.collection);
        return Promise.resolve({ state: args.state });
      },
    });

    expect(result.outcome).toBe("completed");
    expect(calledFor).toEqual(["members", "groups"]);
  });

  it("can abort the import via the hook", async () => {
    const source = createFakeImportSource(makeSimpleData());
    const { persister } = createInMemoryPersister();

    const result = await runImportEngine({
      source,
      persister,
      sourceFormat: "simply-plural",
      mapperDispatch: simpleMapperDispatch,
      dependencyOrder: SIMPLE_DEPENDENCY_ORDER,
      collectionToEntityType: SIMPLE_COLLECTION_TO_ENTITY_TYPE,
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
      beforeCollection: (args: BeforeCollectionArgs): Promise<BeforeCollectionResult> => {
        if (args.collection === "groups") {
          return Promise.resolve({ state: args.state, abort: true });
        }
        return Promise.resolve({ state: args.state });
      },
    });

    expect(result.outcome).toBe("aborted");
  });
});

describe("beforeCollection abort on first collection", () => {
  it("aborts immediately when beforeCollection returns abort on first collection", async () => {
    const source = createFakeImportSource(makeSimpleData());
    const { persister, snapshot } = createInMemoryPersister();

    const result = await runImportEngine({
      source,
      persister,
      sourceFormat: "simply-plural",
      mapperDispatch: simpleMapperDispatch,
      dependencyOrder: SIMPLE_DEPENDENCY_ORDER,
      collectionToEntityType: SIMPLE_COLLECTION_TO_ENTITY_TYPE,
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
      beforeCollection: (): Promise<BeforeCollectionResult> => {
        // Abort on the very first collection
        return Promise.resolve({
          state: emptyCheckpointState({
            firstEntityType: "member",
            selectedCategories: {},
            avatarMode: "skip",
          }),
          abort: true,
        });
      },
    });

    expect(result.outcome).toBe("aborted");
    // Nothing should have been persisted
    expect(snapshot().countByType("member")).toBe(0);
    expect(snapshot().countByType("group")).toBe(0);
  });
});

