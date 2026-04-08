import { describe, expect, it } from "vitest";

import { emptyCheckpointState } from "../../engine/checkpoint.js";
import { collectionToEntityType } from "../../engine/entity-type-map.js";
import { runImport } from "../../engine/import-engine.js";
import { CHECKPOINT_CHUNK_SIZE } from "../../import-sp.constants.js";
import { ApiSourceTokenRejectedError } from "../../sources/api-source.js";
import { createFakeImportSource, type FakeSourceData } from "../../sources/fake-source.js";

import type { Persister, PersistableEntity } from "../../persistence/persister.types.js";
import type { ImportCheckpointState, ImportError } from "@pluralscape/types";

interface RecordingPersister extends Persister {
  readonly upserted: readonly PersistableEntity[];
  readonly errors: readonly ImportError[];
  readonly flushCount: number;
}

interface CreateFakePersisterOptions {
  /**
   * Optional override that lets a single upsert call throw — keyed by source
   * entity ID. Used by error-path tests.
   */
  readonly throwOn?: Readonly<Record<string, Error>>;
}

function createFakePersister(opts: CreateFakePersisterOptions = {}): RecordingPersister {
  const upserted: PersistableEntity[] = [];
  const errors: ImportError[] = [];
  let flushCount = 0;
  let nextId = 1;
  const throwOn = opts.throwOn ?? {};
  return {
    get upserted(): readonly PersistableEntity[] {
      return upserted;
    },
    get errors(): readonly ImportError[] {
      return errors;
    },
    get flushCount(): number {
      return flushCount;
    },
    upsertEntity(entity) {
      const maybeError = throwOn[entity.sourceEntityId];
      if (maybeError !== undefined) return Promise.reject(maybeError);
      upserted.push(entity);
      const id = `ps-${String(nextId++)}`;
      return Promise.resolve({ action: "created" as const, pluralscapeEntityId: id });
    },
    recordError(error) {
      errors.push(error);
      return Promise.resolve();
    },
    flush() {
      flushCount += 1;
      return Promise.resolve();
    },
  };
}

const noopProgress = (): Promise<void> => Promise.resolve();

const ALL_CATEGORIES_ON: Record<string, boolean> = {
  users: true,
  private: true,
  privacyBuckets: true,
  customFields: true,
  frontStatuses: true,
  members: true,
  groups: true,
  frontHistory: true,
  comments: true,
  notes: true,
  polls: true,
  channelCategories: true,
  channels: true,
  chatMessages: true,
  boardMessages: true,
  friends: true,
  pendingFriendRequests: true,
};

describe("runImport — happy path", () => {
  it("walks dependency order, persists all mapped docs, and reports completed", async () => {
    const data: FakeSourceData = {
      privacyBuckets: [
        { _id: "b_pub", name: "Public" },
        { _id: "b_priv", name: "Private" },
      ],
      members: [
        { _id: "m_a", name: "Aria", buckets: ["b_pub"] },
        { _id: "m_b", name: "Brook", buckets: ["b_priv"] },
      ],
      groups: [{ _id: "g_l", name: "Littles", members: ["m_a"] }],
      frontHistory: [
        {
          _id: "fh_1",
          member: "m_a",
          custom: false,
          live: false,
          startTime: 100,
          endTime: 200,
        },
      ],
    };
    const source = createFakeImportSource(data);
    const persister = createFakePersister();
    const result = await runImport({
      source,
      persister,
      options: {
        selectedCategories: ALL_CATEGORIES_ON,
        avatarMode: "skip",
      },
      onProgress: noopProgress,
    });

    expect(result.outcome).toBe("completed");
    expect(result.errors).toEqual([]);

    expect(persister.upserted.map((e) => `${e.entityType}:${e.sourceEntityId}`)).toEqual([
      "privacy-bucket:b_pub",
      "privacy-bucket:b_priv",
      "member:m_a",
      "member:m_b",
      "group:g_l",
      "fronting-session:fh_1",
    ]);

    expect(persister.flushCount).toBeGreaterThanOrEqual(1);

    expect(result.finalState.checkpoint.completedCollections).toContain("privacy-bucket");
    expect(result.finalState.checkpoint.completedCollections).toContain("member");
    expect(result.finalState.checkpoint.completedCollections).toContain("group");
    expect(result.finalState.checkpoint.completedCollections).toContain("fronting-session");

    expect(result.finalState.totals.perCollection.member?.imported).toBe(2);
    expect(result.finalState.totals.perCollection["privacy-bucket"]?.imported).toBe(2);
  });

  it("uses canonical entity types per collection for checkpoint operations", () => {
    expect(collectionToEntityType("members")).toBe("member");
    expect(collectionToEntityType("privacyBuckets")).toBe("privacy-bucket");
    expect(collectionToEntityType("frontHistory")).toBe("fronting-session");
  });
});

describe("runImport — fatal error", () => {
  it("aborts when source iteration throws ApiSourceTokenRejectedError", async () => {
    const tokenError = new ApiSourceTokenRejectedError();
    const source = {
      mode: "fake" as const,
      iterate(): AsyncGenerator<never> {
        async function* gen(): AsyncGenerator<never> {
          await Promise.resolve();
          throw tokenError;
        }
        return gen();
      },
      close(): Promise<void> {
        return Promise.resolve();
      },
    };
    const persister = createFakePersister();
    const result = await runImport({
      source,
      persister,
      options: {
        selectedCategories: ALL_CATEGORIES_ON,
        avatarMode: "skip",
      },
      onProgress: noopProgress,
    });
    expect(result.outcome).toBe("aborted");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.fatal).toBe(true);
    expect(result.errors[0]?.recoverable).toBe(true);
    expect(persister.errors).toHaveLength(1);
    expect(result.finalState.checkpoint.completedCollections).toEqual([]);
  });

  it("aborts when persister.upsertEntity throws a fatal error", async () => {
    const data: FakeSourceData = {
      privacyBuckets: [
        { _id: "b_ok", name: "Public" },
        { _id: "b_fail", name: "Private" },
      ],
    };
    const source = createFakeImportSource(data);
    const persister = createFakePersister({
      throwOn: { b_fail: new ApiSourceTokenRejectedError() },
    });
    const result = await runImport({
      source,
      persister,
      options: {
        selectedCategories: ALL_CATEGORIES_ON,
        avatarMode: "skip",
      },
      onProgress: noopProgress,
    });
    expect(result.outcome).toBe("aborted");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.fatal).toBe(true);
    expect(persister.upserted.map((e) => e.sourceEntityId)).toEqual(["b_ok"]);
    expect(result.finalState.checkpoint.currentCollection).toBe("privacy-bucket");
    expect(result.finalState.checkpoint.currentCollectionLastSourceId).toBe("b_ok");
  });
});

describe("runImport — non-fatal mapper failure", () => {
  it("records the failure and continues iterating", async () => {
    const data: FakeSourceData = {
      members: [
        { _id: "m_ok", name: "Aria" },
        // missing required `name` → validation failure → non-fatal
        { _id: "m_bad" },
        { _id: "m_ok2", name: "Brook" },
      ],
    };
    const source = createFakeImportSource(data);
    const persister = createFakePersister();
    const result = await runImport({
      source,
      persister,
      options: {
        selectedCategories: ALL_CATEGORIES_ON,
        avatarMode: "skip",
      },
      onProgress: noopProgress,
    });
    expect(result.outcome).toBe("completed");
    expect(
      persister.upserted.filter((e) => e.entityType === "member").map((e) => e.sourceEntityId),
    ).toEqual(["m_ok", "m_ok2"]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.fatal).toBe(false);
    expect(result.errors[0]?.entityType).toBe("member");
    expect(result.errors[0]?.entityId).toBe("m_bad");
    expect(result.finalState.totals.perCollection.member?.imported).toBe(2);
    expect(result.finalState.totals.perCollection.member?.failed).toBe(1);
  });
});

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
    expect(result.errors[0]?.fatal).toBe(true);
    expect(result.errors[0]?.recoverable).toBe(true);
    expect(result.errors[0]?.message).toContain("resume cutoff not found in members");
    expect(result.errors[0]?.message).toContain("nonexistent_id");
    // Checkpoint must remain unchanged so the operator can retry.
    expect(result.finalState.checkpoint.currentCollection).toBe("member");
    expect(result.finalState.checkpoint.currentCollectionLastSourceId).toBe("nonexistent_id");
    expect(result.finalState.checkpoint.completedCollections).not.toContain("member");
  });
});

describe("runImport — legacy bucket synthesis", () => {
  it("synthesizes Public/Trusted/Private when privacyBuckets is absent", async () => {
    const data: FakeSourceData = {
      members: [
        { _id: "m_a", name: "Aria", private: true },
        { _id: "m_b", name: "Brook", preventTrusted: true },
      ],
    };
    const source = createFakeImportSource(data);
    const persister = createFakePersister();
    const result = await runImport({
      source,
      persister,
      options: {
        selectedCategories: ALL_CATEGORIES_ON,
        avatarMode: "skip",
      },
      onProgress: noopProgress,
    });
    expect(result.outcome).toBe("completed");
    const bucketUpserts = persister.upserted.filter((e) => e.entityType === "privacy-bucket");
    expect(bucketUpserts).toHaveLength(3);
    expect(bucketUpserts.map((e) => e.sourceEntityId).sort()).toEqual([
      "synthetic:private",
      "synthetic:public",
      "synthetic:trusted",
    ]);
    expect(persister.upserted.filter((e) => e.entityType === "member")).toHaveLength(2);
  });

  it("synthesizes legacy buckets when all privacyBuckets fail validation", async () => {
    // Two bucket docs that both fail Zod validation (missing required `name`).
    // The engine should treat the mapped-bucket count as zero and synthesize
    // the three legacy buckets so members can still resolve their
    // `synthetic:*` references.
    const data: FakeSourceData = {
      privacyBuckets: [{ _id: "b_bad1" }, { _id: "b_bad2" }],
      members: [{ _id: "m_a", name: "Aria", private: true }],
    };
    const source = createFakeImportSource(data);
    const persister = createFakePersister();
    const result = await runImport({
      source,
      persister,
      options: {
        selectedCategories: ALL_CATEGORIES_ON,
        avatarMode: "skip",
      },
      onProgress: noopProgress,
    });
    expect(result.outcome).toBe("completed");
    const bucketUpserts = persister.upserted.filter((e) => e.entityType === "privacy-bucket");
    expect(bucketUpserts.map((e) => e.sourceEntityId).sort()).toEqual([
      "synthetic:private",
      "synthetic:public",
      "synthetic:trusted",
    ]);
    // Two validation failures, one per bad bucket doc.
    const bucketErrors = result.errors.filter((e) => e.entityType === "privacy-bucket");
    expect(bucketErrors).toHaveLength(2);
    expect(bucketErrors.map((e) => e.entityId).sort()).toEqual(["b_bad1", "b_bad2"]);
    for (const error of bucketErrors) {
      expect(error.fatal).toBe(false);
      expect(error.message).toContain("validation");
    }
    // The member was persisted (resolved against the synthetic private bucket).
    expect(persister.upserted.filter((e) => e.entityType === "member")).toHaveLength(1);
  });

  it("does not synthesize legacy buckets when privacyBuckets has data", async () => {
    const data: FakeSourceData = {
      privacyBuckets: [{ _id: "b_pub", name: "Public" }],
      members: [{ _id: "m_a", name: "Aria", buckets: ["b_pub"] }],
    };
    const source = createFakeImportSource(data);
    const persister = createFakePersister();
    const result = await runImport({
      source,
      persister,
      options: {
        selectedCategories: ALL_CATEGORIES_ON,
        avatarMode: "skip",
      },
      onProgress: noopProgress,
    });
    expect(result.outcome).toBe("completed");
    const bucketUpserts = persister.upserted.filter((e) => e.entityType === "privacy-bucket");
    expect(bucketUpserts).toHaveLength(1);
    expect(bucketUpserts[0]?.sourceEntityId).toBe("b_pub");
  });
});

describe("runImport — checkpoint frequency", () => {
  it("flushes and reports progress every CHECKPOINT_CHUNK_SIZE docs", async () => {
    const total = CHECKPOINT_CHUNK_SIZE * 2;
    const members = Array.from({ length: total }, (_, i) => ({
      _id: `m_${String(i).padStart(4, "0")}`,
      name: `Member ${String(i)}`,
    }));
    const data: FakeSourceData = { members };
    const source = createFakeImportSource(data);
    const persister = createFakePersister();
    let progressCalls = 0;
    const result = await runImport({
      source,
      persister,
      options: {
        selectedCategories: ALL_CATEGORIES_ON,
        avatarMode: "skip",
      },
      onProgress: () => {
        progressCalls += 1;
        return Promise.resolve();
      },
    });
    expect(result.outcome).toBe("completed");
    expect(persister.upserted.filter((e) => e.entityType === "member")).toHaveLength(total);
    // Two intra-collection chunk flushes plus one final flush at collection
    // end means at least three onProgress invocations.
    expect(progressCalls).toBeGreaterThanOrEqual(3);
    expect(persister.flushCount).toBeGreaterThanOrEqual(3);
  });
});

describe("runImport — category opt-out", () => {
  it("skips collections whose category is set to false", async () => {
    const data: FakeSourceData = {
      members: [{ _id: "m_a", name: "Aria" }],
      groups: [{ _id: "g_l", name: "Littles", members: ["m_a"] }],
    };
    const source = createFakeImportSource(data);
    const persister = createFakePersister();
    const result = await runImport({
      source,
      persister,
      options: {
        selectedCategories: { ...ALL_CATEGORIES_ON, groups: false },
        avatarMode: "skip",
      },
      onProgress: noopProgress,
    });
    expect(result.outcome).toBe("completed");
    expect(persister.upserted.some((e) => e.entityType === "group")).toBe(false);
    expect(persister.upserted.some((e) => e.entityType === "member")).toBe(true);
  });
});

describe("runImport — id translation carry-forward", () => {
  it("registers persister-returned ids so later mappers can resolve FKs", async () => {
    const data: FakeSourceData = {
      members: [{ _id: "m_a", name: "Aria" }],
      frontHistory: [
        {
          _id: "fh_1",
          member: "m_a",
          custom: false,
          live: false,
          startTime: 0,
          endTime: 100,
        },
      ],
    };
    const source = createFakeImportSource(data);
    const persister = createFakePersister();
    const result = await runImport({
      source,
      persister,
      options: {
        selectedCategories: ALL_CATEGORIES_ON,
        avatarMode: "skip",
      },
      onProgress: noopProgress,
    });
    expect(result.outcome).toBe("completed");
    expect(persister.upserted.find((e) => e.entityType === "fronting-session")).toBeDefined();
    expect(persister.upserted.find((e) => e.entityType === "member")).toBeDefined();
  });
});
