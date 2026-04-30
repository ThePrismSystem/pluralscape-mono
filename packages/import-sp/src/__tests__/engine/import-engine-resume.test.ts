import { emptyCheckpointState } from "@pluralscape/import-core";
import { describe, expect, it } from "vitest";

import { runImport } from "../../engine/import-engine.js";
import { createFakeImportSource, type FakeSourceData } from "../../sources/fake-source.js";
import {
  ALL_CATEGORIES_ON,
  createFakePersister,
  noopProgress,
} from "../helpers/import-engine-fixtures.js";

import type { ImportCheckpointState } from "@pluralscape/types";

describe("runImport — resume", () => {
  it("skips already-processed docs when resuming mid-collection", async () => {
    const data: FakeSourceData = {
      members: [
        { _id: "m_1", name: "Aria" },
        { _id: "m_2", name: "Brook" },
        { _id: "m_3", name: "Cass" },
        { _id: "m_4", name: "Dane" },
      ],
    };
    const source = createFakeImportSource(data);
    const persister = createFakePersister();
    const initial = emptyCheckpointState({
      firstEntityType: "member",
      selectedCategories: ALL_CATEGORIES_ON,
      avatarMode: "skip",
    });
    const resumeState: ImportCheckpointState = {
      ...initial,
      checkpoint: {
        ...initial.checkpoint,
        currentCollection: "member",
        currentCollectionLastSourceId: "m_2",
      },
    };
    const result = await runImport({
      source,
      persister,
      initialCheckpoint: resumeState,
      options: {
        selectedCategories: ALL_CATEGORIES_ON,
        avatarMode: "skip",
      },
      onProgress: noopProgress,
    });
    expect(result.outcome).toBe("completed");
    expect(
      persister.upserted.filter((e) => e.entityType === "member").map((e) => e.sourceEntityId),
    ).toEqual(["m_3", "m_4"]);
  });
});

describe("runImport — resume cutoff missing from source", () => {
  it("aborts when the checkpointed lastSourceId is no longer yielded", async () => {
    const data: FakeSourceData = {
      members: [
        { _id: "m_1", name: "Aria" },
        { _id: "m_2", name: "Brook" },
        { _id: "m_3", name: "Cass" },
      ],
    };
    const source = createFakeImportSource(data);
    const persister = createFakePersister();
    const initial = emptyCheckpointState({
      firstEntityType: "member",
      selectedCategories: ALL_CATEGORIES_ON,
      avatarMode: "skip",
    });
    const resumeState: ImportCheckpointState = {
      ...initial,
      checkpoint: {
        ...initial.checkpoint,
        currentCollection: "member",
        currentCollectionLastSourceId: "nonexistent_id",
      },
    };
    const result = await runImport({
      source,
      persister,
      initialCheckpoint: resumeState,
      options: {
        selectedCategories: ALL_CATEGORIES_ON,
        avatarMode: "skip",
      },
      onProgress: noopProgress,
    });
    expect(result.outcome).toBe("aborted");
    // No member should have been persisted — every doc was gated behind the
    // (never-reached) resume cutoff.
    expect(persister.upserted.filter((e) => e.entityType === "member")).toHaveLength(0);
    // Exactly one error: the resume-cutoff-not-found sentinel.
    expect(result.errors).toHaveLength(1);
    const cutoffError = result.errors[0];
    if (!cutoffError?.fatal) throw new Error("expected fatal error");
    expect(cutoffError.recoverable).toBe(true);
    expect(cutoffError.message).toContain("resume cutoff not found in members");
    expect(cutoffError.message).toContain("nonexistent_id");
    // Checkpoint must remain unchanged so the operator can retry.
    expect(result.finalState.checkpoint.currentCollection).toBe("member");
    expect(result.finalState.checkpoint.currentCollectionLastSourceId).toBe("nonexistent_id");
    expect(result.finalState.checkpoint.completedCollections).not.toContain("member");
  });
});
