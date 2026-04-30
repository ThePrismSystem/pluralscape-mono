/**
 * Import-engine ordering tests.
 *
 * Covers: entity dependency-order pipeline (members-before-groups),
 * FK resolution across collections via the translation table,
 * supplyParentIds callback semantics, and simple 2-collection pipeline
 * baseline assertions.
 *
 * Companion files: import-engine-parsing, import-engine-checkpoint,
 *                  import-engine-persister, import-engine-error-classification
 */

import { describe, expect, it } from "vitest";

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
} from "./helpers/engine-fixtures.js";

import type { FakeSourceData } from "../testing/fake-source.js";

// ---------------------------------------------------------------------------
// Simple 2-collection pipeline
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// FK resolution across collections
// ---------------------------------------------------------------------------

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
    expect(snap.find("group", "g1")?.sourceEntityId).toBe("g1");
    expect(snap.find("group", "g2")?.sourceEntityId).toBe("g2");
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

// ---------------------------------------------------------------------------
// supplyParentIds callback
// ---------------------------------------------------------------------------

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
