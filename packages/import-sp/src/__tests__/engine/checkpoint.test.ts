import { describe, expect, it } from "vitest";

import {
  advanceWithinCollection,
  completeCollection,
  emptyCheckpointState,
  resumeStartCollection,
} from "../../engine/checkpoint.js";

describe("checkpoint helpers", () => {
  it("emptyCheckpointState starts at the first entity type with no completed collections", () => {
    const state = emptyCheckpointState({
      firstEntityType: "member",
      selectedCategories: { member: true },
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

  it("resumeStartCollection returns the currentCollection from the state", () => {
    const state = emptyCheckpointState({
      firstEntityType: "member",
      selectedCategories: {},
      avatarMode: "api",
    });
    expect(resumeStartCollection(state)).toBe("member");
  });
});
