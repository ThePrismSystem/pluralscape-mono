import { describe, expect, it } from "vitest";

import { emptyCheckpointState } from "../checkpoint.js";
import { runImportEngine, buildPersistableEntity } from "../import-engine.js";
import { mapped, failed, skipped } from "../mapper-result.js";
import { createFakeImportSource } from "../testing/fake-source.js";
import { createInMemoryPersister } from "../testing/in-memory-persister.js";

import type { MappingContext } from "../context.js";
import type { BeforeCollectionArgs, BeforeCollectionResult } from "../import-engine.js";
import type {
  MapperDispatchEntry,
  BatchMapperEntry,
  SourceDocument,
  BatchMapperOutput,
} from "../mapper-dispatch.js";
import type { SourceEvent, ImportDataSource } from "../source.types.js";
import type { FakeSourceData } from "../testing/fake-source.js";
import type { ImportCheckpointState, ImportCollectionType } from "@pluralscape/types";

// ---------------------------------------------------------------------------
// Shared test helpers
// ---------------------------------------------------------------------------

const SIMPLE_DEPENDENCY_ORDER = ["members", "groups"];

const SIMPLE_COLLECTION_TO_ENTITY_TYPE = (collection: string): ImportCollectionType => {
  const map: Record<string, ImportCollectionType> = { members: "member", groups: "group" };
  const entityType = map[collection];
  if (!entityType) throw new Error(`Unknown collection: ${collection}`);
  return entityType;
};

const simpleMapperDispatch: Readonly<Record<string, MapperDispatchEntry>> = {
  members: {
    entityType: "member",
    map: (doc: unknown) => mapped(doc),
  },
  groups: {
    entityType: "group",
    map: (doc: unknown, ctx: MappingContext) => {
      const record = doc as Record<string, unknown>;
      const memberRef = record["memberRef"] as string | undefined;
      if (memberRef) {
        const resolved = ctx.translate("member", memberRef);
        if (!resolved) return failed({ kind: "fk-miss", message: `missing member ${memberRef}` });
      }
      return mapped(doc);
    },
  },
};

const noopProgress = (): Promise<void> => Promise.resolve();

function makeSimpleData(): FakeSourceData {
  return {
    members: [
      { _id: "m1", name: "Aria" },
      { _id: "m2", name: "Blake" },
    ],
    groups: [
      { _id: "g1", label: "Front", memberRef: "m1" },
      { _id: "g2", label: "Core", memberRef: "m2" },
    ],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("runImportEngine", () => {
  describe("simple 2-collection pipeline", () => {
    it("persists entities in dependency order and completes", async () => {
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
      });

      expect(result.outcome).toBe("completed");

      const snap = snapshot();
      expect(snap.countByType("member")).toBe(2);
      expect(snap.countByType("group")).toBe(2);
      expect(snap.hasType("member")).toBe(true);
      expect(snap.hasType("group")).toBe(true);

      // Verify member payloads
      expect(snap.find("member", "m1")?.payload).toEqual({ _id: "m1", name: "Aria" });
      expect(snap.find("member", "m2")?.payload).toEqual({ _id: "m2", name: "Blake" });
    });

    it("advances checkpoint totals correctly", async () => {
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
      });

      const memberTotals = result.finalState.totals.perCollection["member"];
      expect(memberTotals?.imported).toBe(2);
      expect(memberTotals?.total).toBe(2);

      const groupTotals = result.finalState.totals.perCollection["group"];
      expect(groupTotals?.imported).toBe(2);
      expect(groupTotals?.total).toBe(2);
    });

    it("marks both collections as completed in the final state", async () => {
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
      });

      expect(result.finalState.checkpoint.completedCollections).toContain("member");
      expect(result.finalState.checkpoint.completedCollections).toContain("group");
    });
  });

  describe("abort signal", () => {
    it("returns aborted outcome when signal fires during iteration", async () => {
      const controller = new AbortController();
      let docCount = 0;

      const data: FakeSourceData = {
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

  describe("batch mapper", () => {
    it("processes all documents in a single batch call", async () => {
      const data: FakeSourceData = {
        members: [
          { _id: "m1", name: "Aria" },
          { _id: "m2", name: "Blake" },
          { _id: "m3", name: "Cass" },
        ],
      };

      let batchCallCount = 0;
      let receivedDocCount = 0;

      const batchEntry: BatchMapperEntry = {
        entityType: "member",
        batch: true,
        mapBatch: (documents: readonly SourceDocument[]): readonly BatchMapperOutput[] => {
          batchCallCount += 1;
          receivedDocCount = documents.length;
          return documents.map((d) => ({
            sourceEntityId: d.sourceId,
            result: mapped(d.document),
          }));
        },
      };

      const batchDispatch: Readonly<Record<string, MapperDispatchEntry>> = {
        members: batchEntry,
      };

      const source = createFakeImportSource(data);
      const { persister, snapshot } = createInMemoryPersister();

      const result = await runImportEngine({
        source,
        persister,
        sourceFormat: "simply-plural",
        mapperDispatch: batchDispatch,
        dependencyOrder: ["members"],
        collectionToEntityType: () => "member",
        options: { selectedCategories: {}, avatarMode: "skip" },
        onProgress: noopProgress,
      });

      expect(result.outcome).toBe("completed");
      expect(batchCallCount).toBe(1);
      expect(receivedDocCount).toBe(3);

      const snap = snapshot();
      expect(snap.countByType("member")).toBe(3);
      expect(snap.find("member", "m1")).toBeDefined();
      expect(snap.find("member", "m2")).toBeDefined();
      expect(snap.find("member", "m3")).toBeDefined();
    });

    it("handles batch mapper returning skipped and failed results", async () => {
      const data: FakeSourceData = {
        members: [
          { _id: "m1", name: "Aria" },
          { _id: "m2", name: "" },
          { _id: "m3", name: "Cass" },
        ],
      };

      const batchEntry: BatchMapperEntry = {
        entityType: "member",
        batch: true,
        mapBatch: (documents: readonly SourceDocument[]): readonly BatchMapperOutput[] => {
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
      };

      const source = createFakeImportSource(data);
      const { persister, snapshot } = createInMemoryPersister();

      const result = await runImportEngine({
        source,
        persister,
        sourceFormat: "simply-plural",
        mapperDispatch: { members: batchEntry },
        dependencyOrder: ["members"],
        collectionToEntityType: () => "member",
        options: { selectedCategories: {}, avatarMode: "skip" },
        onProgress: noopProgress,
      });

      expect(result.outcome).toBe("completed");
      const snap = snapshot();
      expect(snap.countByType("member")).toBe(2);
      expect(result.finalState.totals.perCollection["member"]?.skipped).toBe(1);
    });
  });

  describe("resume from checkpoint", () => {
    it("resumes mid-collection from a prior checkpoint", async () => {
      const data: FakeSourceData = {
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
      const result1 = await runImportEngine({
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

      expect(result1.outcome).toBe("aborted");
      const checkpoint = result1.finalState;
      expect(checkpoint.checkpoint.currentCollectionLastSourceId).toBe("m2");

      // Run 2: resume from checkpoint
      const source2 = createFakeImportSource(data);
      const { persister: persister2, snapshot: snapshot2 } = createInMemoryPersister();

      const result2 = await runImportEngine({
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

      expect(result2.outcome).toBe("completed");

      const snap = snapshot2();
      // Only docs after the cutoff should be persisted (m3, m4)
      expect(snap.countByType("member")).toBe(2);
      expect(snap.find("member", "m3")).toBeDefined();
      expect(snap.find("member", "m4")).toBeDefined();
      // m1 and m2 were processed in the first run, not here
      expect(snap.find("member", "m1")).toBeUndefined();
      expect(snap.find("member", "m2")).toBeUndefined();
    });
  });

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

  describe("error classification", () => {
    it("records non-fatal mapper errors and continues", async () => {
      const data: FakeSourceData = {
        members: [
          { _id: "m1", name: "Aria" },
          { _id: "m2", name: "Blake" },
          { _id: "m3", name: "Cass" },
        ],
      };

      const erroringDispatch: Readonly<Record<string, MapperDispatchEntry>> = {
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
      };

      const source = createFakeImportSource(data);
      const { persister, snapshot } = createInMemoryPersister();

      const result = await runImportEngine({
        source,
        persister,
        sourceFormat: "simply-plural",
        mapperDispatch: erroringDispatch,
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
      expect(snap.find("member", "m1")).toBeDefined();
      expect(snap.find("member", "m3")).toBeDefined();
      expect(snap.find("member", "m2")).toBeUndefined();
    });

    it("records non-fatal persister errors via throwOn and continues", async () => {
      const data: FakeSourceData = {
        members: [
          { _id: "m1", name: "Aria" },
          { _id: "m2", name: "Blake" },
          { _id: "m3", name: "Cass" },
        ],
      };

      const source = createFakeImportSource(data);
      const { persister, snapshot } = createInMemoryPersister({
        throwOn: [
          {
            entityType: "member",
            sourceEntityId: "m2",
            fatal: false,
            error: new Error("persist failed"),
            once: true,
          },
        ],
      });

      const result = await runImportEngine({
        source,
        persister,
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
      });

      expect(result.outcome).toBe("completed");
      // Error from persister is classified as non-fatal by default classifier
      expect(result.errors.some((e) => e.message === "persist failed")).toBe(true);

      const snap = snapshot();
      expect(snap.find("member", "m1")).toBeDefined();
      expect(snap.find("member", "m3")).toBeDefined();
      // m2 failed to persist
      expect(snap.find("member", "m2")).toBeUndefined();
    });
  });

  describe("unknown collection warning", () => {
    it("emits a dropped-collection warning for unrecognised source collections", async () => {
      const source = createFakeImportSource(
        { members: [{ _id: "m1", name: "Aria" }] },
        { extraCollections: ["stickers"] },
      );
      const { persister } = createInMemoryPersister();

      const result = await runImportEngine({
        source,
        persister,
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
      });

      expect(result.outcome).toBe("completed");
      const droppedWarning = result.warnings.find((w) => w.kind === "dropped-collection");
      expect(droppedWarning).toBeDefined();
      expect(droppedWarning?.message).toContain("stickers");
    });
  });

  describe("selected categories", () => {
    it("skips collections the user opted out of", async () => {
      const source = createFakeImportSource(makeSimpleData());
      const { persister, snapshot } = createInMemoryPersister();

      const result = await runImportEngine({
        source,
        persister,
        sourceFormat: "simply-plural",
        mapperDispatch: simpleMapperDispatch,
        dependencyOrder: SIMPLE_DEPENDENCY_ORDER,
        collectionToEntityType: SIMPLE_COLLECTION_TO_ENTITY_TYPE,
        options: { selectedCategories: { group: false }, avatarMode: "skip" },
        onProgress: noopProgress,
      });

      expect(result.outcome).toBe("completed");

      const snap = snapshot();
      expect(snap.countByType("member")).toBe(2);
      expect(snap.countByType("group")).toBe(0);
    });
  });

  describe("buildPersistableEntity()", () => {
    it("builds a persistable entity from valid inputs", () => {
      const entity = buildPersistableEntity("member", "src-1", "simply-plural", { name: "Aria" });
      expect(entity.entityType).toBe("member");
      expect(entity.sourceEntityId).toBe("src-1");
      expect(entity.source).toBe("simply-plural");
      expect(entity.payload).toEqual({ name: "Aria" });
    });

    it("throws for null payload", () => {
      expect(() => buildPersistableEntity("member", "src-1", "simply-plural", null)).toThrow(
        "non-object payload",
      );
    });

    it("throws for primitive payload", () => {
      expect(() => buildPersistableEntity("member", "src-1", "simply-plural", "string")).toThrow(
        "non-object payload",
      );
    });
  });

  describe("FK resolution across collections", () => {
    it("resolves member FK in group mapper via translation table", async () => {
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
      });

      expect(result.outcome).toBe("completed");
      // Both groups should be persisted since their member refs exist
      const snap = snapshot();
      expect(snap.find("group", "g1")).toBeDefined();
      expect(snap.find("group", "g2")).toBeDefined();
    });

    it("fails group doc when referenced member was not imported", async () => {
      const data: FakeSourceData = {
        members: [], // No members imported
        groups: [{ _id: "g1", label: "Orphan", memberRef: "m-nonexistent" }],
      };

      const source = createFakeImportSource(data);
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
      });

      expect(result.outcome).toBe("completed");
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.kind).toBe("fk-miss");
      expect(result.errors[0]?.message).toContain("m-nonexistent");

      const snap = snapshot();
      expect(snap.countByType("group")).toBe(0);
    });
  });

  describe("source.close() error path", () => {
    it("produces a warning when source.close() throws", async () => {
      const data = makeSimpleData();
      const source = createFakeImportSource(data);
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

  describe("drop events from source", () => {
    it("records drop events as non-fatal errors and continues", async () => {
      const source: ImportDataSource = {
        mode: "fake",
        async *iterate(collection: string): AsyncGenerator<SourceEvent> {
          await Promise.resolve();
          if (collection === "members") {
            yield {
              kind: "drop",
              collection,
              sourceId: "m1",
              reason: "malformed document",
            };
            yield {
              kind: "doc",
              collection,
              sourceId: "m2",
              document: { _id: "m2", name: "Blake" },
            };
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

  describe("source iteration fatal throw", () => {
    it("produces a fatal error when iterate() throws mid-iteration", async () => {
      const source: ImportDataSource = {
        mode: "fake",
        async *iterate(collection: string): AsyncGenerator<SourceEvent> {
          await Promise.resolve();
          if (collection === "members") {
            yield {
              kind: "doc",
              collection,
              sourceId: "m1",
              document: { _id: "m1", name: "Aria" },
            };
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

  describe("supplyParentIds callback", () => {
    it("calls supplyParentIds with persisted source IDs after collection completes", async () => {
      const suppliedParentIds: { collection: string; ids: readonly string[] }[] = [];
      const data = makeSimpleData();
      const source = createFakeImportSource(data);
      source.supplyParentIds = (collection: string, ids: readonly string[]) => {
        suppliedParentIds.push({ collection, ids: [...ids] });
      };
      const { persister } = createInMemoryPersister();

      await runImportEngine({
        source,
        persister,
        sourceFormat: "simply-plural",
        mapperDispatch: simpleMapperDispatch,
        dependencyOrder: SIMPLE_DEPENDENCY_ORDER,
        collectionToEntityType: SIMPLE_COLLECTION_TO_ENTITY_TYPE,
        options: { selectedCategories: {}, avatarMode: "skip" },
        onProgress: noopProgress,
      });

      expect(suppliedParentIds).toHaveLength(2);
      expect(suppliedParentIds[0]?.collection).toBe("members");
      expect(suppliedParentIds[0]?.ids).toEqual(["m1", "m2"]);
      expect(suppliedParentIds[1]?.collection).toBe("groups");
      expect(suppliedParentIds[1]?.ids).toEqual(["g1", "g2"]);
    });
  });

  describe("source.close() is always called", () => {
    it("calls close even on successful completion", async () => {
      let closeCalled = false;
      const data: FakeSourceData = {
        members: [{ _id: "m1", name: "A" }],
      };
      const baseSource = createFakeImportSource(data);
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

  // -----------------------------------------------------------------------
  // Batch mapper coverage
  // -----------------------------------------------------------------------

  describe("batch mapper path", () => {
    const batchDependencyOrder = ["items"];
    const batchCollectionToEntityType = (): ImportCollectionType => "member";

    function makeBatchSource(docs: Record<string, unknown>[]): ImportDataSource {
      return {
        mode: "fake",
        async *iterate(): AsyncGenerator<SourceEvent> {
          await Promise.resolve();
          for (const doc of docs) {
            yield {
              kind: "doc",
              collection: "items",
              sourceId: doc["_id"] as string,
              document: doc,
            };
          }
        },
        listCollections: () => Promise.resolve(["items"]),
        close: () => Promise.resolve(),
      };
    }

    function makeBatchDispatch(
      mapBatch: (
        docs: readonly SourceDocument[],
        ctx: MappingContext,
      ) => readonly BatchMapperOutput[],
    ): Readonly<Record<string, MapperDispatchEntry>> {
      return {
        items: { entityType: "member", batch: true, mapBatch } as BatchMapperEntry,
      };
    }

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
        dependencyOrder: batchDependencyOrder,
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
        dependencyOrder: batchDependencyOrder,
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
        dependencyOrder: batchDependencyOrder,
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
        dependencyOrder: batchDependencyOrder,
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
        dependencyOrder: batchDependencyOrder,
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
        dependencyOrder: batchDependencyOrder,
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
        dependencyOrder: batchDependencyOrder,
        collectionToEntityType: batchCollectionToEntityType,
        options: { selectedCategories: {}, avatarMode: "skip" },
        onProgress: noopProgress,
      });

      expect(result.outcome).toBe("aborted");
      expect(result.errors[0]?.fatal).toBe(true);
      expect(result.errors[0]?.message).toBe("batch network error");
    });

    it("handles updated and skipped upsert actions in batch path", async () => {
      const docs = [
        { _id: "b1", name: "One" },
        { _id: "b2", name: "Two" },
      ];
      const source1 = makeBatchSource(docs);
      const { persister, snapshot } = createInMemoryPersister();
      const dispatch = makeBatchDispatch((d) =>
        d.map((doc) => ({ sourceEntityId: doc.sourceId, result: mapped(doc.document) })),
      );

      // First run: all created
      await runImportEngine({
        source: source1,
        persister,
        sourceFormat: "simply-plural",
        mapperDispatch: dispatch,
        dependencyOrder: batchDependencyOrder,
        collectionToEntityType: batchCollectionToEntityType,
        options: { selectedCategories: {}, avatarMode: "skip" },
        onProgress: noopProgress,
      });
      expect(snapshot().countByType("member")).toBe(2);

      // Second run with same data: upserts return "skipped" (content identical)
      const source2 = makeBatchSource(docs);
      const result2 = await runImportEngine({
        source: source2,
        persister,
        sourceFormat: "simply-plural",
        mapperDispatch: dispatch,
        dependencyOrder: batchDependencyOrder,
        collectionToEntityType: batchCollectionToEntityType,
        options: { selectedCategories: {}, avatarMode: "skip" },
        onProgress: noopProgress,
      });
      expect(result2.outcome).toBe("completed");

      // Third run with different data: upserts return "updated"
      const source3 = makeBatchSource([
        { _id: "b1", name: "Updated" },
        { _id: "b2", name: "Changed" },
      ]);
      const result3 = await runImportEngine({
        source: source3,
        persister,
        sourceFormat: "simply-plural",
        mapperDispatch: dispatch,
        dependencyOrder: batchDependencyOrder,
        collectionToEntityType: batchCollectionToEntityType,
        options: { selectedCategories: {}, avatarMode: "skip" },
        onProgress: noopProgress,
      });
      expect(result3.outcome).toBe("completed");
      expect(snapshot().countByType("member")).toBe(2);
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
        dependencyOrder: batchDependencyOrder,
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
        dependencyOrder: batchDependencyOrder,
        collectionToEntityType: batchCollectionToEntityType,
        options: { selectedCategories: {}, avatarMode: "skip" },
        onProgress: noopProgress,
      });

      expect(result.outcome).toBe("completed");
      expect(result.errors).toHaveLength(1);
      expect(snapshot().countByType("member")).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // Selected categories opt-out
  // -----------------------------------------------------------------------

  describe("selected categories opt-out", () => {
    it("skips collection when selectedCategories is false for its entity type", async () => {
      const source = createFakeImportSource(makeSimpleData());
      const { persister, snapshot } = createInMemoryPersister();

      const result = await runImportEngine({
        source,
        persister,
        sourceFormat: "simply-plural",
        mapperDispatch: simpleMapperDispatch,
        dependencyOrder: SIMPLE_DEPENDENCY_ORDER,
        collectionToEntityType: SIMPLE_COLLECTION_TO_ENTITY_TYPE,
        options: { selectedCategories: { member: false }, avatarMode: "skip" },
        onProgress: noopProgress,
      });

      expect(result.outcome).toBe("completed");
      expect(snapshot().countByType("member")).toBe(0);
      // Groups depend on members but since members were skipped, FK misses are expected
      expect(snapshot().countByType("group")).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // No mapper entry for collection
  // -----------------------------------------------------------------------

  describe("missing mapper entry", () => {
    it("skips collection with no mapper in dispatch table", async () => {
      const source = createFakeImportSource({
        members: [{ _id: "m1", name: "Aria" }],
        extras: [{ _id: "e1", data: "test" }],
      });
      const { persister, snapshot } = createInMemoryPersister();

      const result = await runImportEngine({
        source,
        persister,
        sourceFormat: "simply-plural",
        mapperDispatch: {
          members: { entityType: "member", map: (doc: unknown) => mapped(doc) },
          // No entry for "extras"
        },
        dependencyOrder: ["members", "extras"],
        collectionToEntityType: (c: string) => (c === "members" ? "member" : "group"),
        options: { selectedCategories: {}, avatarMode: "skip" },
        onProgress: noopProgress,
      });

      expect(result.outcome).toBe("completed");
      expect(snapshot().countByType("member")).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // Drop event with null sourceId
  // -----------------------------------------------------------------------

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

  // -----------------------------------------------------------------------
  // Upsert action coverage (updated, skipped)
  // -----------------------------------------------------------------------

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
      const result2 = await runImportEngine({
        source: source2,
        persister,
        sourceFormat: "simply-plural",
        mapperDispatch: simpleMapperDispatch,
        dependencyOrder: SIMPLE_DEPENDENCY_ORDER,
        collectionToEntityType: SIMPLE_COLLECTION_TO_ENTITY_TYPE,
        options: { selectedCategories: {}, avatarMode: "skip" },
        onProgress: noopProgress,
      });

      expect(result2.outcome).toBe("completed");
      // Entities still exist (no duplicates)
      expect(snapshot().countByType("member")).toBe(2);
    });
  });

  // -----------------------------------------------------------------------
  // Abort after drop in single mapper path
  // -----------------------------------------------------------------------

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

  // -----------------------------------------------------------------------
  // Non-fatal persister error in single mapper path
  // -----------------------------------------------------------------------

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

  // -----------------------------------------------------------------------
  // Skipped single-mapper result
  // -----------------------------------------------------------------------

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

  // -----------------------------------------------------------------------
  // Resume from checkpoint with unknown entity type
  // -----------------------------------------------------------------------

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

  // -----------------------------------------------------------------------
  // Failed mapper result in single mapper path
  // -----------------------------------------------------------------------

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

  // -----------------------------------------------------------------------
  // Custom classifyError injection
  // -----------------------------------------------------------------------

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
        dependencyOrder: ["items"],
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
      expect(result.errors[0]?.fatal).toBe(true);
      expect(snapshot().countByType("member")).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Fatal persister error in single mapper via classifyError
  // -----------------------------------------------------------------------

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
      expect(snapshot().find("member", "m1")).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // selectedCategories opt-out advances checkpoint for non-last collection
  // -----------------------------------------------------------------------

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

  // -----------------------------------------------------------------------
  // beforeCollection hook abort on first collection
  // -----------------------------------------------------------------------

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

  // -----------------------------------------------------------------------
  // source.close() error produces warning even on aborted run
  // -----------------------------------------------------------------------

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
      expect(closeWarning).toBeDefined();
      expect(closeWarning?.message).toContain("close leaked handle");
    });
  });

  // -----------------------------------------------------------------------
  // supplyParentIds NOT called when persistedSourceIds is empty
  // -----------------------------------------------------------------------

  describe("supplyParentIds with empty persisted IDs", () => {
    it("does NOT call supplyParentIds when all entities in a collection fail", async () => {
      const suppliedParentIds: { collection: string; ids: readonly string[] }[] = [];
      const source = createFakeImportSource({
        members: [
          { _id: "m1", name: "bad" },
          { _id: "m2", name: "bad" },
        ],
      });
      source.supplyParentIds = (collection: string, ids: readonly string[]) => {
        suppliedParentIds.push({ collection, ids: [...ids] });
      };
      const { persister } = createInMemoryPersister();

      await runImportEngine({
        source,
        persister,
        sourceFormat: "simply-plural",
        mapperDispatch: {
          members: {
            entityType: "member",
            map: () => failed({ kind: "validation-failed", message: "always fail" }),
          },
        },
        dependencyOrder: ["members"],
        collectionToEntityType: () => "member",
        options: { selectedCategories: {}, avatarMode: "skip" },
        onProgress: noopProgress,
      });

      // supplyParentIds should NOT be called when no entities were persisted
      expect(suppliedParentIds).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // source-missing-collection warning
  // -----------------------------------------------------------------------

  describe("source-missing-collection warning", () => {
    it("emits a warning when dependencyOrder has a collection not in source", async () => {
      // Source only has "members" but dependency order expects "members" and "groups"
      const source = createFakeImportSource({
        members: [{ _id: "m1", name: "Aria" }],
      });
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
      const missingWarning = result.warnings.find(
        (w) => w.key === "source-missing-collection:groups",
      );
      expect(missingWarning).toBeDefined();
      expect(missingWarning?.message).toContain("groups");
      expect(missingWarning?.message).toContain("not reported by the source");
    });
  });

  // -----------------------------------------------------------------------
  // Batch mapper resume cutoff behaviour
  // -----------------------------------------------------------------------

  describe("batch mapper resume from checkpoint", () => {
    it("skips documents before the resume cutoff in batch path", async () => {
      const batchEntry: BatchMapperEntry = {
        entityType: "member",
        batch: true,
        mapBatch: (documents: readonly SourceDocument[]): readonly BatchMapperOutput[] =>
          documents.map((d) => ({ sourceEntityId: d.sourceId, result: mapped(d.document) })),
      };

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

      const result1 = await runImportEngine({
        source: source1,
        persister: persister1,
        sourceFormat: "simply-plural",
        mapperDispatch: { items: batchEntry },
        dependencyOrder: ["items"],
        collectionToEntityType: () => "member",
        options: { selectedCategories: {}, avatarMode: "skip" },
        onProgress: noopProgress,
      });

      // First run completes — b1 dropped, b2 persisted. Now build a
      // checkpoint that says we left off at b2 mid-collection.
      expect(result1.outcome).toBe("completed");

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

      const result2 = await runImportEngine({
        source: source2,
        persister: persister2,
        sourceFormat: "simply-plural",
        mapperDispatch: { items: batchEntry },
        dependencyOrder: ["items"],
        collectionToEntityType: () => "member",
        options: { selectedCategories: {}, avatarMode: "skip" },
        onProgress: noopProgress,
        initialCheckpoint: resumeCheckpoint,
      });

      expect(result2.outcome).toBe("completed");
      const snap = snapshot2();
      // b1 and b2 should be skipped (before/at the cutoff)
      expect(snap.find("member", "b1")).toBeUndefined();
      expect(snap.find("member", "b2")).toBeUndefined();
      // b3 and b4 should be persisted (after the cutoff)
      expect(snap.find("member", "b3")).toBeDefined();
      expect(snap.find("member", "b4")).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // Abort signal fires before collection iteration
  // -----------------------------------------------------------------------

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

  // -----------------------------------------------------------------------
  // Source iteration throw classified as non-fatal gets overridden to fatal
  // -----------------------------------------------------------------------

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
        dependencyOrder: ["items"],
        collectionToEntityType: () => "member",
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

  // -----------------------------------------------------------------------
  // persistMapperResult stateRef propagation
  // -----------------------------------------------------------------------

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

  describe("empty dependencyOrder", () => {
    it("throws when dependencyOrder is empty", async () => {
      const source = createFakeImportSource({});
      const { persister } = createInMemoryPersister();

      await expect(
        runImportEngine({
          source,
          persister,
          sourceFormat: "simply-plural",
          mapperDispatch: {},
          dependencyOrder: [],
          collectionToEntityType: SIMPLE_COLLECTION_TO_ENTITY_TYPE,
          options: { selectedCategories: {}, avatarMode: "skip" },
          onProgress: noopProgress,
        }),
      ).rejects.toThrow(/dependency order is empty/i);
    });
  });
});
