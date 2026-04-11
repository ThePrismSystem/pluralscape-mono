import { describe, expect, it } from "vitest";

import {
  advanceWithinCollection,
  bumpCollectionTotals,
  completeCollection,
  emptyCheckpointState,
  resumeStartCollection,
  type AdvanceDelta,
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

describe("bumpCollectionTotals", () => {
  const delta: AdvanceDelta = { total: 1, imported: 0, updated: 0, skipped: 0, failed: 1 };

  it("bumps perCollection totals without advancing currentCollectionLastSourceId", () => {
    const base = emptyCheckpointState({
      firstEntityType: "member",
      selectedCategories: {},
      avatarMode: "skip",
    });
    const prevCursor = base.checkpoint.currentCollectionLastSourceId;
    const after = bumpCollectionTotals(base, "member", delta);

    expect(after.totals.perCollection.member).toEqual({
      total: 1,
      imported: 0,
      updated: 0,
      skipped: 0,
      failed: 1,
    });
    expect(after.checkpoint.currentCollectionLastSourceId).toBe(prevCursor);
    expect(after.checkpoint.currentCollection).toBe("member");
  });

  it("accumulates totals across multiple bumps", () => {
    const base = emptyCheckpointState({
      firstEntityType: "member",
      selectedCategories: {},
      avatarMode: "skip",
    });
    const once = bumpCollectionTotals(base, "member", delta);
    const twice = bumpCollectionTotals(once, "member", delta);
    expect(twice.totals.perCollection.member?.failed).toBe(2);
    expect(twice.totals.perCollection.member?.total).toBe(2);
  });
});
