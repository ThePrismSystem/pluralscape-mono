/**
 * Import-engine parsing tests.
 *
 * Covers: input parsing (buildPersistableEntity), collection filtering
 * (selectedCategories, missing mapper entries, empty dependencyOrder),
 * and unknown-collection / missing-source-collection warnings.
 *
 * Companion files: import-engine-ordering, import-engine-checkpoint,
 *                  import-engine-persister, import-engine-error-classification
 */

import { describe, expect, it } from "vitest";

import { runImportEngine, buildPersistableEntity } from "../import-engine.js";
import {
  SIMPLE_DEPENDENCY_ORDER,
  SIMPLE_COLLECTION_TO_ENTITY_TYPE,
  makeSimpleData,
  simpleMapperDispatch,
  noopProgress,
  createFakeImportSource,
  createInMemoryPersister,
  mapped,
} from "./helpers/engine-fixtures.js";

// ---------------------------------------------------------------------------
// buildPersistableEntity()
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// selected categories opt-out
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// unknown collection warning
// ---------------------------------------------------------------------------

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
    expect(droppedWarning?.message).toContain("stickers");
  });
});

// ---------------------------------------------------------------------------
// No mapper entry for collection
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// source-missing-collection warning
// ---------------------------------------------------------------------------

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
    expect(missingWarning?.message).toContain("groups");
    expect(missingWarning?.message).toContain("not reported by the source");
  });
});

// ---------------------------------------------------------------------------
// empty dependencyOrder
// ---------------------------------------------------------------------------

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
