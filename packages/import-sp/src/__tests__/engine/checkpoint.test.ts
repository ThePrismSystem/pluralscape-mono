import { describe, expect, it } from "vitest";

import {
  advanceWithinCollection,
  completeCollection,
  emptyCheckpointState,
  resumeStartCollection,
  shouldSkipBefore,
} from "../../engine/checkpoint.js";

describe("checkpoint helpers", () => {
  it("emptyCheckpointState starts at the first entity type with no completed collections", () => {
    const state = emptyCheckpointState({
      firstEntityType: "member",
      selectedCategories: { members: true },
      avatarMode: "api",
    });
    expect(state.schemaVersion).toBe(1);
    expect(state.checkpoint.currentCollection).toBe("member");
    expect(state.checkpoint.completedCollections).toEqual([]);
    expect(state.checkpoint.currentCollectionLastSourceId).toBeNull();
  });

  it("advanceWithinCollection updates lastSourceId and increments totals", () => {
    let state = emptyCheckpointState({
      firstEntityType: "member",
      selectedCategories: {},
      avatarMode: "api",
    });
    state = advanceWithinCollection(state, {
      entityType: "member",
      lastSourceId: "src_5",
      delta: { imported: 3, updated: 1, skipped: 0, failed: 0, total: 4 },
    });
    expect(state.checkpoint.currentCollectionLastSourceId).toBe("src_5");
    expect(state.totals.perCollection.member?.imported).toBe(3);
    expect(state.totals.perCollection.member?.updated).toBe(1);
  });

  it("completeCollection moves currentCollection to next and clears lastSourceId", () => {
    let state = emptyCheckpointState({
      firstEntityType: "member",
      selectedCategories: {},
      avatarMode: "api",
    });
    state = advanceWithinCollection(state, {
      entityType: "member",
      lastSourceId: "src_99",
      delta: { imported: 10, updated: 0, skipped: 0, failed: 0, total: 10 },
    });
    state = completeCollection(state, { nextEntityType: "group" });
    expect(state.checkpoint.completedCollections).toContain("member");
    expect(state.checkpoint.currentCollection).toBe("group");
    expect(state.checkpoint.currentCollectionLastSourceId).toBeNull();
  });

  it("shouldSkipBefore returns true for source IDs ≤ lastSourceId", () => {
    const state = advanceWithinCollection(
      emptyCheckpointState({
        firstEntityType: "member",
        selectedCategories: {},
        avatarMode: "api",
      }),
      {
        entityType: "member",
        lastSourceId: "src_5",
        delta: { imported: 1, updated: 0, skipped: 0, failed: 0, total: 1 },
      },
    );
    expect(shouldSkipBefore(state, "member", "src_3")).toBe(true);
    expect(shouldSkipBefore(state, "member", "src_5")).toBe(true);
    expect(shouldSkipBefore(state, "member", "src_6")).toBe(false);
  });

  it("shouldSkipBefore returns false for non-current collections", () => {
    const state = emptyCheckpointState({
      firstEntityType: "member",
      selectedCategories: {},
      avatarMode: "api",
    });
    expect(shouldSkipBefore(state, "group", "anything")).toBe(false);
  });

  it("resumeStartCollection returns the currentCollection from the state", () => {
    const state = emptyCheckpointState({
      firstEntityType: "member",
      selectedCategories: {},
      avatarMode: "api",
    });
    expect(resumeStartCollection(state)).toBe("member");
  });
});
