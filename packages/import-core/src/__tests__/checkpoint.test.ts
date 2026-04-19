import { describe, expect, it } from "vitest";

import {
  advanceWithinCollection,
  bumpCollectionTotals,
  completeCollection,
  emptyCheckpointState,
  markRealPrivacyBucketsMapped,
  resumeStartCollection,
} from "../checkpoint.js";

describe("emptyCheckpointState()", () => {
  it("initializes with the first entity type as current collection", () => {
    const state = emptyCheckpointState({
      firstEntityType: "member",
      selectedCategories: { member: true, group: true },
      avatarMode: "skip",
    });

    expect(state.schemaVersion).toBe(2);
    expect(state.checkpoint.currentCollection).toBe("member");
    expect(state.checkpoint.currentCollectionLastSourceId).toBeNull();
    expect(state.checkpoint.completedCollections).toEqual([]);
    expect(state.options.selectedCategories).toEqual({ member: true, group: true });
    expect(state.options.avatarMode).toBe("skip");
    expect(state.totals.perCollection).toEqual({});
  });
});

describe("advanceWithinCollection()", () => {
  it("increments totals and tracks lastSourceId", () => {
    const initial = emptyCheckpointState({
      firstEntityType: "member",
      selectedCategories: {},
      avatarMode: "skip",
    });

    const advanced = advanceWithinCollection(initial, {
      entityType: "member",
      lastSourceId: "src-1",
      delta: { imported: 1, updated: 0, skipped: 0, failed: 0, total: 1 },
    });

    expect(advanced.checkpoint.currentCollection).toBe("member");
    expect(advanced.checkpoint.currentCollectionLastSourceId).toBe("src-1");
    expect(advanced.totals.perCollection["member"]).toEqual({
      total: 1,
      imported: 1,
      updated: 0,
      skipped: 0,
      failed: 0,
    });
  });

  it("accumulates totals across multiple advances", () => {
    let state = emptyCheckpointState({
      firstEntityType: "member",
      selectedCategories: {},
      avatarMode: "skip",
    });

    state = advanceWithinCollection(state, {
      entityType: "member",
      lastSourceId: "src-1",
      delta: { imported: 1, updated: 0, skipped: 0, failed: 0, total: 1 },
    });

    state = advanceWithinCollection(state, {
      entityType: "member",
      lastSourceId: "src-2",
      delta: { imported: 0, updated: 0, skipped: 1, failed: 0, total: 1 },
    });

    expect(state.checkpoint.currentCollectionLastSourceId).toBe("src-2");
    expect(state.totals.perCollection["member"]).toEqual({
      total: 2,
      imported: 1,
      updated: 0,
      skipped: 1,
      failed: 0,
    });
  });
});

describe("completeCollection()", () => {
  it("advances to the next entity type and resets lastSourceId", () => {
    let state = emptyCheckpointState({
      firstEntityType: "member",
      selectedCategories: {},
      avatarMode: "skip",
    });

    state = advanceWithinCollection(state, {
      entityType: "member",
      lastSourceId: "src-5",
      delta: { imported: 1, updated: 0, skipped: 0, failed: 0, total: 1 },
    });

    state = completeCollection(state, { nextEntityType: "group" });

    expect(state.checkpoint.completedCollections).toEqual(["member"]);
    expect(state.checkpoint.currentCollection).toBe("group");
    expect(state.checkpoint.currentCollectionLastSourceId).toBeNull();
  });

  it("does not duplicate a completed collection if already present", () => {
    let state = emptyCheckpointState({
      firstEntityType: "member",
      selectedCategories: {},
      avatarMode: "skip",
    });

    // Complete member -> move to group
    state = completeCollection(state, { nextEntityType: "group" });
    expect(state.checkpoint.completedCollections).toEqual(["member"]);

    // Complete group -> move to group again (simulating last collection)
    // "group" should appear exactly once
    state = completeCollection(state, { nextEntityType: "group" });
    expect(state.checkpoint.completedCollections).toEqual(["member", "group"]);

    // Call again with same currentCollection "group" — should not duplicate
    state = completeCollection(state, { nextEntityType: "group" });
    expect(state.checkpoint.completedCollections).toEqual(["member", "group"]);
  });
});

describe("bumpCollectionTotals()", () => {
  it("increments totals without changing lastSourceId", () => {
    let state = emptyCheckpointState({
      firstEntityType: "member",
      selectedCategories: {},
      avatarMode: "skip",
    });

    state = advanceWithinCollection(state, {
      entityType: "member",
      lastSourceId: "src-1",
      delta: { imported: 1, updated: 0, skipped: 0, failed: 0, total: 1 },
    });

    state = bumpCollectionTotals(state, "member", {
      imported: 0,
      updated: 0,
      skipped: 0,
      failed: 1,
      total: 1,
    });

    // lastSourceId unchanged
    expect(state.checkpoint.currentCollectionLastSourceId).toBe("src-1");
    expect(state.totals.perCollection["member"]).toEqual({
      total: 2,
      imported: 1,
      updated: 0,
      skipped: 0,
      failed: 1,
    });
  });
});

describe("resumeStartCollection()", () => {
  it("returns the current collection from the checkpoint", () => {
    const state = emptyCheckpointState({
      firstEntityType: "member",
      selectedCategories: {},
      avatarMode: "skip",
    });

    expect(resumeStartCollection(state)).toBe("member");
  });

  it("returns the advanced collection after completeCollection", () => {
    let state = emptyCheckpointState({
      firstEntityType: "member",
      selectedCategories: {},
      avatarMode: "skip",
    });

    state = completeCollection(state, { nextEntityType: "group" });
    expect(resumeStartCollection(state)).toBe("group");
  });
});

describe("markRealPrivacyBucketsMapped()", () => {
  it("flips the flag from false to true and preserves other fields", () => {
    const initial = emptyCheckpointState({
      firstEntityType: "member",
      selectedCategories: { member: true },
      avatarMode: "skip",
    });
    expect(initial.checkpoint.realPrivacyBucketsMapped).toBe(false);

    const marked = markRealPrivacyBucketsMapped(initial);

    expect(marked.checkpoint.realPrivacyBucketsMapped).toBe(true);
    expect(marked.schemaVersion).toBe(2);
    expect(marked.checkpoint.currentCollection).toBe("member");
    expect(marked.checkpoint.completedCollections).toEqual([]);
    expect(marked.options.selectedCategories).toEqual({ member: true });
  });

  it("is idempotent — repeat calls return the same state reference", () => {
    const initial = markRealPrivacyBucketsMapped(
      emptyCheckpointState({
        firstEntityType: "member",
        selectedCategories: {},
        avatarMode: "skip",
      }),
    );

    const second = markRealPrivacyBucketsMapped(initial);

    expect(second).toBe(initial);
    expect(second.checkpoint.realPrivacyBucketsMapped).toBe(true);
  });
});
