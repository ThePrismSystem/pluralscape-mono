import { describe, expect, it } from "vitest";

import { emptyCheckpointState } from "../../engine/checkpoint.js";
import { collectionToEntityType } from "../../engine/entity-type-map.js";
import { buildPersistableEntity, runImport } from "../../engine/import-engine.js";
import { CHECKPOINT_CHUNK_SIZE } from "../../import-sp.constants.js";
import { ApiSourceTokenRejectedError } from "../../sources/api-source.js";
import { createFakeImportSource, type FakeSourceData } from "../../sources/fake-source.js";

import type { Persister, PersistableEntity } from "../../persistence/persister.types.js";
import type { ImportDataSource, SourceEvent } from "../../sources/source.types.js";
import type { ImportCheckpointState, ImportCollectionType, ImportError } from "@pluralscape/types";

function stubSource(
  events: readonly SourceEvent[],
  collections: readonly string[] = ["members"],
): ImportDataSource {
  return {
    mode: "fake",
    async *iterate(collection) {
      for (const e of events) {
        if (e.collection !== collection) continue;
        await Promise.resolve();
        yield e;
      }
    },
    listCollections() {
      return Promise.resolve(collections);
    },
    close() {
      return Promise.resolve();
    },
  };
}

describe("runImport — drop events", () => {
  it("records drop events as non-fatal failures and continues iteration", async () => {
    const source = stubSource([
      {
        kind: "doc",
        collection: "members",
        sourceId: "m1",
        document: { _id: "m1", name: "Aria", buckets: [] },
      },
      { kind: "drop", collection: "members", sourceId: "m2", reason: "non-object body" },
      {
        kind: "doc",
        collection: "members",
        sourceId: "m3",
        document: { _id: "m3", name: "Cass", buckets: [] },
      },
    ]);
    const persister = createFakePersister();
    const result = await runImport({
      source,
      persister,
      options: { selectedCategories: { member: true }, avatarMode: "skip" },
      onProgress: noopProgress,
    });

    expect(result.outcome).toBe("completed");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.kind).toBe("invalid-source-document");
    expect(result.errors[0]?.entityId).toBe("m2");
    expect(result.errors[0]?.fatal).toBe(false);
    expect(
      persister.upserted.filter((e) => e.entityType === "member").map((e) => e.sourceEntityId),
    ).toEqual(["m1", "m3"]);
  });

  it("drop with null sourceId does not advance the checkpoint cursor", async () => {
    // A drop event with sourceId=null must not call advanceWithinCollection
    // (which would overwrite the last-known cursor). We verify indirectly:
    // bumpCollectionTotals is used instead, so m1's cursor position survives
    // and m1 is still persisted successfully.
    const source = stubSource([
      {
        kind: "doc",
        collection: "members",
        sourceId: "m1",
        document: { _id: "m1", name: "Aria", buckets: [] },
      },
      { kind: "drop", collection: "members", sourceId: null, reason: "non-object body" },
    ]);
    const persister = createFakePersister();
    const result = await runImport({
      source,
      persister,
      options: { selectedCategories: { member: true }, avatarMode: "skip" },
      onProgress: noopProgress,
    });

    // The null-sourceId drop must be recorded as a non-fatal failure.
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.entityId).toBeNull();
    expect(result.errors[0]?.fatal).toBe(false);
    // The null drop counts toward the failed total.
    expect(result.finalState.totals.perCollection.member?.failed).toBe(1);
    // m1 was successfully imported — the null drop did not corrupt iteration.
    expect(
      persister.upserted.filter((e) => e.entityType === "member").map((e) => e.sourceEntityId),
    ).toEqual(["m1"]);
  });

  it("warns on DEPENDENCY_ORDER collections missing from source.listCollections()", async () => {
    // stubSource lists only ["members"] — all other DEPENDENCY_ORDER collections
    // are absent and should each produce a source-missing-collection warning.
    const source = stubSource(
      [
        {
          kind: "doc",
          collection: "members",
          sourceId: "m1",
          document: { _id: "m1", name: "Aria", buckets: [] },
        },
      ],
      ["members"],
    );
    const persister = createFakePersister();
    const result = await runImport({
      source,
      persister,
      options: { selectedCategories: { member: true }, avatarMode: "skip" },
      onProgress: noopProgress,
    });

    expect(result.outcome).toBe("completed");
    const missingKeys = result.warnings
      .filter(
        (w): w is typeof w & { key: string } =>
          typeof w.key === "string" && w.key.startsWith("source-missing-collection:"),
      )
      .map((w) => w.key);
    expect(missingKeys.length).toBeGreaterThan(0);
    expect(missingKeys).toContain("source-missing-collection:privacyBuckets");
    expect(missingKeys).toContain("source-missing-collection:frontHistory");
  });
});

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

const ALL_CATEGORIES_ON: Partial<Record<ImportCollectionType, boolean>> = {
  "system-profile": true,
  "system-settings": true,
  "privacy-bucket": true,
  "field-definition": true,
  "custom-front": true,
  member: true,
  group: true,
  "fronting-session": true,
  "fronting-comment": true,
  "journal-entry": true,
  poll: true,
  "channel-category": true,
  channel: true,
  "chat-message": true,
  "board-message": true,
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
      listCollections(): Promise<readonly string[]> {
        return Promise.resolve([]);
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
    const firstError = result.errors[0];
    if (!firstError?.fatal) throw new Error("expected fatal error");
    expect(firstError.recoverable).toBe(true);
    expect(persister.errors).toHaveLength(1);
    expect(result.finalState.checkpoint.completedCollections).toEqual([]);
  });

  it("marks generic iterator throws as fatal even when classifier would say non-fatal", async () => {
    // A plain `Error` thrown from the iterator: `classifyError` would
    // normally treat this as non-fatal (per-document failure), but the
    // engine must override that because iteration cannot continue.
    const source = {
      mode: "fake" as const,
      iterate(): AsyncGenerator<never> {
        async function* gen(): AsyncGenerator<never> {
          await Promise.resolve();
          throw new Error("generic boom");
        }
        return gen();
      },
      listCollections(): Promise<readonly string[]> {
        return Promise.resolve([]);
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
    expect(result.errors[0]?.message).toBe("generic boom");
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

describe("runImport — abort signal", () => {
  it("returns aborted immediately when signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const source = createFakeImportSource({
      privacyBuckets: [{ _id: "bk1", name: "Public", description: null }],
    });
    const result = await runImport({
      source,
      persister: createFakePersister(),
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
      abortSignal: controller.signal,
    });
    expect(result.outcome).toBe("aborted");
    await source.close();
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
        selectedCategories: { ...ALL_CATEGORIES_ON, group: false },
        avatarMode: "skip",
      },
      onProgress: noopProgress,
    });
    expect(result.outcome).toBe("completed");
    expect(persister.upserted.some((e) => e.entityType === "group")).toBe(false);
    expect(persister.upserted.some((e) => e.entityType === "member")).toBe(true);
  });
});

describe("runImport — selectedCategories opt-out", () => {
  it("skips a collection when user opts out via ImportCollectionType key", async () => {
    const data: FakeSourceData = {
      frontStatuses: [{ _id: "sp_cf_1", name: "Blurry" }],
    };
    const source = createFakeImportSource(data);
    const persister = createFakePersister();
    const result = await runImport({
      source,
      persister,
      options: {
        selectedCategories: { ...ALL_CATEGORIES_ON, "custom-front": false },
        avatarMode: "skip",
      },
      onProgress: noopProgress,
    });

    expect(result.outcome).toBe("completed");
    // The opt-out must have been honored — no custom-front upsert should
    // have occurred.
    expect(persister.upserted.filter((e) => e.entityType === "custom-front")).toHaveLength(0);
  });
});

describe("runImport — dropped collections", () => {
  it("emits a dropped-collection warning when the source reports an unknown top-level key", async () => {
    const data: FakeSourceData = {
      members: [{ _id: "m_a", name: "Aria" }],
    };
    const source = createFakeImportSource(data, {
      extraCollections: ["friends", "pendingFriendRequests"],
    });
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
    const dropped = result.warnings.filter(
      (w): w is typeof w & { key: string } =>
        w.kind === "dropped-collection" &&
        typeof w.key === "string" &&
        w.key.startsWith("dropped-collection:"),
    );
    expect(dropped.map((w) => w.key).sort()).toEqual([
      "dropped-collection:friends",
      "dropped-collection:pendingFriendRequests",
    ]);
    for (const warning of dropped) {
      expect(warning.entityType).toBe("unknown");
      expect(warning.entityId).toBeNull();
    }
  });

  it("does not warn for known SP collections", async () => {
    const data: FakeSourceData = {
      members: [{ _id: "m_a", name: "Aria" }],
      groups: [{ _id: "g_1", name: "Littles", members: ["m_a"] }],
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
    // Only genuine "unknown" dropped-collection warnings (key prefix
    // "dropped-collection:") should be absent; source-missing-collection
    // warnings also use kind "dropped-collection" but have a different key.
    expect(
      result.warnings.some(
        (w) =>
          w.kind === "dropped-collection" &&
          typeof w.key === "string" &&
          w.key.startsWith("dropped-collection:"),
      ),
    ).toBe(false);
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

describe("runImport — surprise policy end-to-end", () => {
  it("reports fk-miss failures in the final error list with structured kind", async () => {
    // A channel references a parentCategory that does not exist in the
    // source. The channel mapper returns `failed({ kind: "fk-miss" })`,
    // which the engine plumbs into `ImportError.kind`.
    const data: FakeSourceData = {
      channelCategories: [{ _id: "cat_a", name: "General" }],
      channels: [
        { _id: "ch_ok", name: "welcome", parentCategory: "cat_a", description: null },
        { _id: "ch_orphan", name: "orphan", parentCategory: "cat_missing", description: null },
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
    const fkMissErrors = result.errors.filter((e) => e.kind === "fk-miss");
    expect(fkMissErrors).toHaveLength(1);
    const firstFkMiss = fkMissErrors[0];
    expect(firstFkMiss?.entityType).toBe("channel");
    expect(firstFkMiss?.entityId).toBe("ch_orphan");
    expect(firstFkMiss?.fatal).toBe(false);
    // The healthy channel still imports successfully.
    expect(
      persister.upserted.filter((e) => e.entityType === "channel").map((e) => e.sourceEntityId),
    ).toEqual(["ch_ok"]);
  });

  it("emits dropped-collection warning for the SP friends collection", async () => {
    const data: FakeSourceData = {
      members: [{ _id: "m_a", name: "Aria" }],
    };
    const source = createFakeImportSource(data, {
      extraCollections: ["friends"],
    });
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
    const dropped = result.warnings.filter(
      (w): w is typeof w & { key: string } =>
        w.kind === "dropped-collection" &&
        typeof w.key === "string" &&
        w.key.startsWith("dropped-collection:"),
    );
    expect(dropped).toHaveLength(1);
    expect(dropped[0]?.message).toContain("friends");
  });

  // TODO: Exercising the warnings-truncated marker via the engine requires a
  // mapper pipeline that emits `MAX_WARNING_BUFFER_SIZE + 1` warnings from
  // real documents. The marker behaviour is already covered at the context
  // unit level in `context.test.ts`; a full E2E variant depends on T28+
  // wiring `warnUnknownKeys` through the dispatch table so unknown-field
  // drift actually produces per-doc warnings. Skipped deliberately — see
  // the import-sp Phase 2 follow-up.
  it.skip("emits warnings-truncated marker when warning buffer overflows (pending mapper wiring)", () => {
    // Left intentionally empty — unskip once passthrough unknown-field
    // warnings are wired through the dispatch table.
  });

  it("surfaces unknown-field warnings from passthrough validators", async () => {
    const data: FakeSourceData = {
      members: [{ _id: "m_unk_warn_1", name: "Aria", _unknownFutureField: "drift-value" }],
    };
    const source = createFakeImportSource(data);
    const persister = createFakePersister();
    const result = await runImport({
      source,
      persister,
      options: { selectedCategories: ALL_CATEGORIES_ON, avatarMode: "skip" },
      onProgress: noopProgress,
    });
    expect(result.outcome).toBe("completed");
    const unkWarning = result.warnings.find(
      (w) => w.kind === "unknown-field" && w.message.includes("_unknownFutureField"),
    );
    expect(unkWarning).toBeDefined();
    expect(unkWarning?.entityType).toBe("member");
  });
});

describe("runImport — source.close() lifecycle", () => {
  it("calls source.close() on successful completion", async () => {
    let closed = false;
    const source = createFakeImportSource({});
    const wrappedSource: ImportDataSource = {
      ...source,
      async close() {
        await source.close();
        closed = true;
      },
    };
    const persister = createFakePersister();
    await runImport({
      source: wrappedSource,
      persister,
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
    });
    expect(closed).toBe(true);
  });

  it("calls source.close() even when iteration throws", async () => {
    let closed = false;
    const source: ImportDataSource = {
      mode: "fake",
      listCollections() {
        return Promise.resolve(["members"]);
      },
      async *iterate() {
        await Promise.resolve();
        throw new Error("boom");
      },
      close() {
        closed = true;
        return Promise.resolve();
      },
    };
    const persister = createFakePersister();
    await runImport({
      source,
      persister,
      options: { selectedCategories: { member: true }, avatarMode: "skip" },
      onProgress: noopProgress,
    });
    expect(closed).toBe(true);
  });
});

describe("runImport — abort signal during iteration", () => {
  it("aborts mid-iteration after processing a doc event", async () => {
    const controller = new AbortController();
    const source: ImportDataSource = {
      mode: "fake",
      listCollections() {
        return Promise.resolve(["members"]);
      },
      async *iterate(collection) {
        if (collection !== "members") return;
        await Promise.resolve();
        yield {
          kind: "doc" as const,
          collection: "members" as const,
          sourceId: "m1",
          document: { _id: "m1", name: "Aria" },
        };
        // Abort BEFORE yielding m2. The engine checked the signal after
        // processing m1 (still false), then resumes the generator, which
        // sets aborted=true and yields m2. The engine processes m2, then
        // checks the signal again (now true) and returns "aborted".
        controller.abort();
        yield {
          kind: "doc" as const,
          collection: "members" as const,
          sourceId: "m2",
          document: { _id: "m2", name: "Brook" },
        };
        yield {
          kind: "doc" as const,
          collection: "members" as const,
          sourceId: "m3",
          document: { _id: "m3", name: "Cass" },
        };
      },
      close() {
        return Promise.resolve();
      },
    };
    const persister = createFakePersister();
    const result = await runImport({
      source,
      persister,
      options: { selectedCategories: { member: true }, avatarMode: "skip" },
      onProgress: noopProgress,
      abortSignal: controller.signal,
    });
    expect(result.outcome).toBe("aborted");
    // m1 and m2 were processed (m2 was already yielded before the check);
    // m3 was not reached.
    expect(
      persister.upserted.filter((e) => e.entityType === "member").map((e) => e.sourceEntityId),
    ).toEqual(["m1", "m2"]);
  });

  it("aborts mid-iteration after processing a drop event", async () => {
    const controller = new AbortController();
    const source: ImportDataSource = {
      mode: "fake",
      listCollections() {
        return Promise.resolve(["members"]);
      },
      async *iterate(collection) {
        if (collection !== "members") return;
        await Promise.resolve();
        // Abort BEFORE yielding the drop. The engine resumes the generator,
        // which sets aborted=true and yields the drop. The engine processes
        // the drop, checks the signal (now true), and returns "aborted".
        controller.abort();
        yield {
          kind: "drop" as const,
          collection: "members" as const,
          sourceId: "m1",
          reason: "non-object body",
        };
        yield {
          kind: "doc" as const,
          collection: "members" as const,
          sourceId: "m2",
          document: { _id: "m2", name: "Brook" },
        };
      },
      close() {
        return Promise.resolve();
      },
    };
    const persister = createFakePersister();
    const result = await runImport({
      source,
      persister,
      options: { selectedCategories: { member: true }, avatarMode: "skip" },
      onProgress: noopProgress,
      abortSignal: controller.signal,
    });
    expect(result.outcome).toBe("aborted");
    // The drop was processed (abort was set before yield, checked after);
    // m2 was not reached.
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.kind).toBe("invalid-source-document");
    expect(persister.upserted.filter((e) => e.entityType === "member")).toHaveLength(0);
  });
});

describe("runImport — source.close() error suppression", () => {
  it("does not mask the result when source.close() throws", async () => {
    const source: ImportDataSource = {
      mode: "fake",
      listCollections() {
        return Promise.resolve([]);
      },
      async *iterate() {
        // yield nothing
      },
      close() {
        return Promise.reject(new Error("close failed"));
      },
    };
    const persister = createFakePersister();
    // The engine must swallow the close error and return the import result
    const result = await runImport({
      source,
      persister,
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
    });
    expect(result.outcome).toBe("completed");
    const closeWarning = result.warnings.find((w) => w.key === "source-close-error");
    expect(closeWarning).toBeDefined();
    expect(closeWarning?.message).toContain("close failed");
  });
});

describe("runImport — fatal error during legacy bucket synthesis", () => {
  it("aborts when persister throws a fatal error during synthetic bucket upsert", async () => {
    // No privacyBuckets data → engine will synthesize legacy buckets before
    // entering members. We make the persister throw a fatal error on
    // synthetic:public to trigger the abort path inside persistSynthesizedBuckets.
    const data: FakeSourceData = {
      members: [{ _id: "m_a", name: "Aria" }],
    };
    const source = createFakeImportSource(data);
    const persister = createFakePersister({
      throwOn: { "synthetic:public": new ApiSourceTokenRejectedError() },
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
  });
});

describe("runImport — non-fatal persister error continues iteration", () => {
  it("records non-fatal persister failure and continues to the next doc", async () => {
    const data: FakeSourceData = {
      members: [
        { _id: "m_ok1", name: "Aria" },
        { _id: "m_fail", name: "Brook" },
        { _id: "m_ok2", name: "Cass" },
      ],
    };
    const source = createFakeImportSource(data);
    // A generic Error is classified as non-fatal by classifyError
    const persister = createFakePersister({
      throwOn: { m_fail: new Error("transient DB error") },
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
    expect(result.outcome).toBe("completed");
    expect(
      persister.upserted.filter((e) => e.entityType === "member").map((e) => e.sourceEntityId),
    ).toEqual(["m_ok1", "m_ok2"]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.fatal).toBe(false);
    expect(result.finalState.totals.perCollection.member?.failed).toBe(1);
  });
});

describe("buildPersistableEntity runtime guard", () => {
  it("accepts an object payload", () => {
    const entity = buildPersistableEntity("member", "src1", { name: "Alice" });
    expect(entity.entityType).toBe("member");
    expect(entity.sourceEntityId).toBe("src1");
    expect(entity.source).toBe("simply-plural");
  });

  it("throws on null payload", () => {
    expect(() => buildPersistableEntity("member", "src1", null)).toThrow(/non-object payload/);
  });

  it("throws on string payload", () => {
    expect(() => buildPersistableEntity("member", "src1", "alice")).toThrow(/non-object payload/);
  });

  it("throws on number payload", () => {
    expect(() => buildPersistableEntity("member", "src1", 42)).toThrow(/non-object payload/);
  });

  it("throws on undefined payload", () => {
    expect(() => buildPersistableEntity("member", "src1", undefined)).toThrow(/non-object payload/);
  });
});
