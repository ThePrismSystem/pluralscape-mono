import { emptyCheckpointState } from "@pluralscape/import-core";
import { describe, expect, it, vi } from "vitest";

import { collectionToEntityType } from "../../engine/entity-type-map.js";
import { runImport } from "../../engine/import-engine.js";
import { createFakeImportSource } from "../../sources/fake-source.js";

import type { Persister } from "../../persistence/persister.types.js";

/** Find the first mock call whose first argument matches the given collection name. */
function findCallForCollection(calls: readonly unknown[][], name: string): unknown[] | undefined {
  return calls.find((call) => call[0] === name);
}

function noopProgress(): Promise<void> {
  return Promise.resolve();
}

function makeMockPersister(): Persister {
  let nextId = 1;
  return {
    upsertEntity() {
      const id = `ps-${String(nextId++)}`;
      return Promise.resolve({ action: "created" as const, pluralscapeEntityId: id });
    },
    async recordError() {},
    async flush() {},
  };
}

describe("engine supplyParentIds integration", () => {
  it("calls supplyParentIds on the source after completing a collection with processed docs", async () => {
    const supplyParentIds = vi.fn();

    const source = createFakeImportSource({
      members: [
        { _id: "m1", name: "Alice" },
        { _id: "m2", name: "Bob" },
      ],
    });

    // Monkey-patch supplyParentIds onto the fake source
    (source as { supplyParentIds?: typeof supplyParentIds }).supplyParentIds = supplyParentIds;

    await runImport({
      source,
      persister: makeMockPersister(),
      initialCheckpoint: emptyCheckpointState({
        firstEntityType: collectionToEntityType("users"),
        selectedCategories: {},
        avatarMode: "skip",
      }),
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
    });

    // The engine should have called supplyParentIds for "members" with ["m1", "m2"]
    const memberCall = findCallForCollection(supplyParentIds.mock.calls, "members");
    if (memberCall === undefined) {
      expect.fail("supplyParentIds should have been called for members");
    }
    const sourceIds = memberCall[1] as readonly string[];
    expect(sourceIds).toContain("m1");
    expect(sourceIds).toContain("m2");
  });

  it("does not call supplyParentIds for collections with zero successfully persisted docs", async () => {
    const supplyParentIds = vi.fn();

    // Source with an empty members collection — no docs to persist
    const source = createFakeImportSource({
      members: [],
    });

    (source as { supplyParentIds?: typeof supplyParentIds }).supplyParentIds = supplyParentIds;

    await runImport({
      source,
      persister: makeMockPersister(),
      initialCheckpoint: emptyCheckpointState({
        firstEntityType: collectionToEntityType("users"),
        selectedCategories: {},
        avatarMode: "skip",
      }),
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
    });

    // No docs were persisted for members, so supplyParentIds should not be called for it
    const memberCall = findCallForCollection(supplyParentIds.mock.calls, "members");
    expect(memberCall).toBeUndefined();
  });

  it("excludes failed docs from the supplied source IDs", async () => {
    const supplyParentIds = vi.fn();

    const source = createFakeImportSource({
      members: [
        { _id: "m1", name: "Alice" },
        // m2 has no name — mapper will fail validation
        { _id: "m2" },
        { _id: "m3", name: "Cass" },
      ],
    });

    (source as { supplyParentIds?: typeof supplyParentIds }).supplyParentIds = supplyParentIds;

    await runImport({
      source,
      persister: makeMockPersister(),
      initialCheckpoint: emptyCheckpointState({
        firstEntityType: collectionToEntityType("users"),
        selectedCategories: {},
        avatarMode: "skip",
      }),
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
    });

    const memberCall = findCallForCollection(supplyParentIds.mock.calls, "members");
    if (memberCall === undefined) {
      expect.fail("supplyParentIds should have been called for members");
    }
    const sourceIds = memberCall[1] as readonly string[];
    // m1 and m3 should be present (successfully persisted); m2 should not
    expect(sourceIds).toContain("m1");
    expect(sourceIds).toContain("m3");
    expect(sourceIds).not.toContain("m2");
  });
});
