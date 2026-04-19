/**
 * Branch-coverage tests for `import-engine.ts`.
 *
 * Each test targets a specific uncovered branch identified during audit:
 *
 *  1. Resume past members — `privacyBucketsMapped` initializes to 1 when the
 *     checkpoint has `"member"` in `completedCollections`, suppressing legacy
 *     bucket synthesis on later collections.
 *  2. Non-fatal synthesis error — a non-fatal error during
 *     `persistSynthesizedBuckets` records the error and continues.
 *  3. All synthetic buckets fail — `synth.lastSourceId` stays `null` so the
 *     `advanceWithinCollection` call is skipped but `completeCollection`
 *     still fires.
 *  4. safeStartIndex clamp — when the resume entity type maps to a collection
 *     not in `DEPENDENCY_ORDER`, `indexOf` returns -1, clamped to 0.
 *  5. Category opt-out marks collection complete and advances to the next
 *     entity type (testing the `nextCollection` lookup within the opt-out
 *     path).
 *  6. `privacyBucketsMapped` counter increments only for successfully mapped
 *     and persisted privacyBuckets documents, not for validation failures.
 */
import { describe, expect, it } from "vitest";

import { DEPENDENCY_ORDER } from "../../engine/dependency-order.js";
import { collectionToEntityType } from "../../engine/entity-type-map.js";
import { runImport } from "../../engine/import-engine.js";
import { ApiSourceTokenRejectedError } from "../../sources/api-source.js";
import { createFakeImportSource, type FakeSourceData } from "../../sources/fake-source.js";

import type {
  PersistableEntity,
  Persister,
  PersisterUpsertResult,
} from "../../persistence/persister.types.js";
import type { ImportCheckpointState, ImportCollectionType, ImportError } from "@pluralscape/types";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

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

interface RecordingPersister extends Persister {
  readonly upserted: readonly PersistableEntity[];
  readonly errors: readonly ImportError[];
  readonly flushCount: number;
}

interface CreateFakePersisterOptions {
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
    upsertEntity(entity: PersistableEntity): Promise<PersisterUpsertResult> {
      const maybeError = throwOn[entity.sourceEntityId];
      if (maybeError !== undefined) return Promise.reject(maybeError);
      upserted.push(entity);
      const id = `ps-${String(nextId++)}`;
      return Promise.resolve({ action: "created" as const, pluralscapeEntityId: id });
    },
    recordError(error: ImportError): Promise<void> {
      errors.push(error);
      return Promise.resolve();
    },
    flush(): Promise<void> {
      flushCount += 1;
      return Promise.resolve();
    },
  };
}

// ---------------------------------------------------------------------------
// 1. Resume past members — privacyBucketsMapped init = 1
// ---------------------------------------------------------------------------

describe("import engine — resume past members suppresses legacy synthesis", () => {
  it("does not synthesize legacy buckets when resuming after member collection is already complete", async () => {
    // Build a checkpoint where member is already in completedCollections,
    // resuming at "group". This means privacyBucketsMapped initializes to 1
    // (line 286) and bucket synthesis must NOT fire.
    const memberIndex = DEPENDENCY_ORDER.indexOf("members");
    const completedCollections: ImportCollectionType[] = DEPENDENCY_ORDER.slice(
      0,
      memberIndex + 1,
    ).map((c) => collectionToEntityType(c));

    const checkpoint: ImportCheckpointState = {
      schemaVersion: 2,
      checkpoint: {
        completedCollections,
        currentCollection: "group",
        currentCollectionLastSourceId: null,
        // The prior run mapped real privacy buckets — suppress synthesis.
        realPrivacyBucketsMapped: true,
      },
      options: { selectedCategories: {}, avatarMode: "skip" },
      totals: { perCollection: {} },
    };

    // Source has groups but no privacyBuckets — normally this would trigger
    // synthesis, but since we resumed past members, it must not.
    const data: FakeSourceData = {
      groups: [{ _id: "g_1", name: "Pod Alpha", members: [] }],
    };
    const source = createFakeImportSource(data);
    const persister = createFakePersister();

    const result = await runImport({
      source,
      persister,
      initialCheckpoint: checkpoint,
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
    });

    expect(result.outcome).toBe("completed");
    // No synthetic bucket upserts should have occurred.
    const bucketUpserts = persister.upserted.filter((e) => e.entityType === "privacy-bucket");
    expect(bucketUpserts).toHaveLength(0);
    // The group was persisted normally.
    expect(persister.upserted.some((e) => e.entityType === "group")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. Non-fatal synthesis error — records and continues
// ---------------------------------------------------------------------------

describe("import engine — non-fatal error during legacy bucket synthesis", () => {
  it("records a non-fatal synthesis error and continues to persist remaining buckets and members", async () => {
    // No privacyBuckets → synthesis fires. Make synthetic:public throw a
    // generic Error (classified as non-fatal by classifyError). The other
    // two synthetic buckets should still succeed, and members should still
    // be processed.
    const data: FakeSourceData = {
      members: [{ _id: "m_a", name: "Aria", private: true }],
    };
    const source = createFakeImportSource(data);
    const persister = createFakePersister({
      throwOn: { "synthetic:public": new Error("transient DB glitch") },
    });

    const result = await runImport({
      source,
      persister,
      options: { selectedCategories: ALL_CATEGORIES_ON, avatarMode: "skip" },
      onProgress: noopProgress,
    });

    expect(result.outcome).toBe("completed");
    // One non-fatal error for the failed synthetic bucket.
    const synthErrors = result.errors.filter(
      (e) => e.entityType === "privacy-bucket" && e.entityId === "synthetic:public",
    );
    expect(synthErrors).toHaveLength(1);
    expect(synthErrors[0]?.fatal).toBe(false);
    // The other two synthetic buckets were persisted.
    const bucketUpserts = persister.upserted.filter((e) => e.entityType === "privacy-bucket");
    expect(bucketUpserts).toHaveLength(2);
    expect(bucketUpserts.map((e) => e.sourceEntityId).sort()).toEqual([
      "synthetic:private",
      "synthetic:trusted",
    ]);
    // Members were still processed.
    expect(persister.upserted.some((e) => e.entityType === "member")).toBe(true);
    // Checkpoint totals for privacy-bucket reflect 2 imported + 1 failed.
    expect(result.finalState.totals.perCollection["privacy-bucket"]?.imported).toBe(2);
    expect(result.finalState.totals.perCollection["privacy-bucket"]?.failed).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 3. All synthetic buckets fail — lastSourceId stays null
// ---------------------------------------------------------------------------

describe("import engine — all synthetic bucket upserts fail non-fatally", () => {
  it("skips advanceWithinCollection when all synthesis upserts fail but still completes the collection", async () => {
    // Make all three synthetic bucket IDs throw non-fatal errors.
    const data: FakeSourceData = {
      members: [{ _id: "m_a", name: "Aria", private: true }],
    };
    const source = createFakeImportSource(data);
    const persister = createFakePersister({
      throwOn: {
        "synthetic:public": new Error("db failure 1"),
        "synthetic:trusted": new Error("db failure 2"),
        "synthetic:private": new Error("db failure 3"),
      },
    });

    const result = await runImport({
      source,
      persister,
      options: { selectedCategories: ALL_CATEGORIES_ON, avatarMode: "skip" },
      onProgress: noopProgress,
    });

    // Run should complete (errors are non-fatal).
    expect(result.outcome).toBe("completed");
    // Three synthesis errors recorded.
    const synthErrors = result.errors.filter(
      (e) =>
        e.entityType === "privacy-bucket" &&
        typeof e.entityId === "string" &&
        e.entityId.startsWith("synthetic:"),
    );
    expect(synthErrors).toHaveLength(3);
    for (const err of synthErrors) {
      expect(err.fatal).toBe(false);
    }
    // No bucket upserts succeeded.
    expect(persister.upserted.filter((e) => e.entityType === "privacy-bucket")).toHaveLength(0);
    // privacy-bucket collection is still marked complete (completeCollection fires).
    expect(result.finalState.checkpoint.completedCollections).toContain("privacy-bucket");
    // When all three buckets fail, synth.lastSourceId stays null so
    // advanceWithinCollection is never called and perCollection totals for
    // privacy-bucket are not populated from the synthesis path. The failures
    // ARE still recorded in the errors array (asserted above).
  });
});

// ---------------------------------------------------------------------------
// 4. Category opt-out advances checkpoint past collection
// ---------------------------------------------------------------------------

describe("import engine — category opt-out checkpoint advancement", () => {
  it("marks the opted-out collection as complete and does not process its documents", async () => {
    // Opt out of "group" (not privacy-bucket, because opting out of
    // privacy-bucket still triggers legacy synthesis at member entry).
    const data: FakeSourceData = {
      members: [{ _id: "m_a", name: "Aria" }],
      groups: [{ _id: "g_1", name: "Pod Alpha", members: ["m_a"] }],
    };
    const source = createFakeImportSource(data);
    const persister = createFakePersister();

    const result = await runImport({
      source,
      persister,
      options: {
        selectedCategories: {
          ...ALL_CATEGORIES_ON,
          group: false,
        },
        avatarMode: "skip",
      },
      onProgress: noopProgress,
    });

    expect(result.outcome).toBe("completed");
    // No group upserts — even though the source has group data.
    expect(persister.upserted.filter((e) => e.entityType === "group")).toHaveLength(0);
    // group is still in completedCollections (opt-out calls completeCollection).
    expect(result.finalState.checkpoint.completedCollections).toContain("group");
    // Members were still processed (they come earlier in dependency order).
    expect(persister.upserted.some((e) => e.entityType === "member")).toBe(true);
  });

  it("opts out of the last collection in dependency order", async () => {
    const data: FakeSourceData = {};
    const source = createFakeImportSource(data);
    const persister = createFakePersister();

    const lastCollection = DEPENDENCY_ORDER[DEPENDENCY_ORDER.length - 1];
    if (lastCollection === undefined) throw new Error("DEPENDENCY_ORDER is empty");
    const lastEntityType = collectionToEntityType(lastCollection);

    const result = await runImport({
      source,
      persister,
      options: {
        selectedCategories: {
          ...ALL_CATEGORIES_ON,
          [lastEntityType]: false,
        },
        avatarMode: "skip",
      },
      onProgress: noopProgress,
    });

    expect(result.outcome).toBe("completed");
    // The last collection is marked complete even when opted out.
    expect(result.finalState.checkpoint.completedCollections).toContain(lastEntityType);
    // When the opted-out collection is the last one, the `nextEntityType`
    // fallback (no next collection) uses the current entityType.
    // This covers the `nextCollection ? ... : entityType` branch.
  });
});

// ---------------------------------------------------------------------------
// 5. privacyBucketsMapped counter increments on successful bucket persist
// ---------------------------------------------------------------------------

describe("import engine — privacyBucketsMapped counter", () => {
  it("counts mapped privacyBuckets docs and suppresses synthesis when count > 0", async () => {
    // Source has exactly one valid privacyBucket. After processing it,
    // privacyBucketsMapped > 0, so legacy synthesis must NOT fire when
    // entering members — even though members use legacy privacy flags.
    const data: FakeSourceData = {
      privacyBuckets: [{ _id: "bk_1", name: "Public" }],
      members: [{ _id: "m_a", name: "Aria", buckets: ["bk_1"] }],
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
    // Only 1 privacy-bucket upsert — the one from the source.
    // If synthesis ran, there would be 4 (1 source + 3 synthetic).
    const bucketUpserts = persister.upserted.filter((e) => e.entityType === "privacy-bucket");
    expect(bucketUpserts).toHaveLength(1);
    expect(bucketUpserts[0]?.sourceEntityId).toBe("bk_1");
  });

  it("treats all-failed privacyBuckets as zero mapped and synthesizes legacy buckets", async () => {
    // Two invalid bucket docs (missing name). Both fail validation, so
    // privacyBucketsMapped stays 0 → synthesis fires at member entry.
    const data: FakeSourceData = {
      privacyBuckets: [{ _id: "b_bad1" }, { _id: "b_bad2" }],
      members: [{ _id: "m_a", name: "Aria", private: true }],
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
    // Three synthetic buckets were persisted (validation failures leave
    // privacyBucketsMapped at 0).
    const bucketUpserts = persister.upserted.filter((e) => e.entityType === "privacy-bucket");
    expect(bucketUpserts.map((e) => e.sourceEntityId).sort()).toEqual([
      "synthetic:private",
      "synthetic:public",
      "synthetic:trusted",
    ]);
    // Two validation failures from the bad bucket docs.
    const bucketErrors = result.errors.filter((e) => e.entityType === "privacy-bucket");
    expect(bucketErrors).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// 6. Resume mid-member with bucket synthesis restores resume cutoff
// ---------------------------------------------------------------------------

describe("import engine — resume mid-member with bucket synthesis", () => {
  it("synthesizes buckets on resume and restores the member resume cutoff", async () => {
    // Build a checkpoint where we are mid-member with lastSourceId = "m_2".
    // completedCollections includes everything before members but NOT
    // "member" and NOT "privacy-bucket" — this means:
    //   a) privacyBucketsMapped starts at 0 (member not in completed)
    //   b) Legacy synthesis fires when we enter members
    //   c) The resume cutoff "m_2" must be preserved through synthesis
    const memberIndex = DEPENDENCY_ORDER.indexOf("members");
    const preMemberCollections: ImportCollectionType[] = DEPENDENCY_ORDER.slice(0, memberIndex).map(
      (c) => collectionToEntityType(c),
    );
    // Remove privacy-bucket from completed so synthesis fires
    const completedWithoutBuckets = preMemberCollections.filter((c) => c !== "privacy-bucket");

    const checkpoint: ImportCheckpointState = {
      schemaVersion: 2,
      checkpoint: {
        completedCollections: completedWithoutBuckets,
        currentCollection: "member",
        currentCollectionLastSourceId: "m_2",
        // No prior real buckets mapped — synthesis must fire.
        realPrivacyBucketsMapped: false,
      },
      options: { selectedCategories: {}, avatarMode: "skip" },
      totals: { perCollection: {} },
    };

    const data: FakeSourceData = {
      members: [
        { _id: "m_1", name: "Aria", private: true },
        { _id: "m_2", name: "Brook", private: true },
        { _id: "m_3", name: "Cass", private: true },
        { _id: "m_4", name: "Dane", private: true },
      ],
    };
    const source = createFakeImportSource(data);
    const persister = createFakePersister();

    const result = await runImport({
      source,
      persister,
      initialCheckpoint: checkpoint,
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
    });

    expect(result.outcome).toBe("completed");
    // Synthetic buckets were persisted (synthesis fired).
    const bucketUpserts = persister.upserted.filter((e) => e.entityType === "privacy-bucket");
    expect(bucketUpserts).toHaveLength(3);
    // Only m_3 and m_4 were persisted (m_1 and m_2 skipped by resume cutoff).
    const memberUpserts = persister.upserted.filter((e) => e.entityType === "member");
    expect(memberUpserts.map((e) => e.sourceEntityId)).toEqual(["m_3", "m_4"]);
  });
});

// ---------------------------------------------------------------------------
// 7. Fatal error during bucket synthesis aborts with lastSourceId = null
// ---------------------------------------------------------------------------

describe("import engine — fatal synthesis error on first bucket", () => {
  it("aborts when the very first synthetic bucket throws a fatal error (lastSourceId null)", async () => {
    // synthesizeLegacyBuckets yields public → trusted → private.
    // Making the first one (synthetic:public) fatal means lastSourceId
    // stays null — covering the early-return path in persistSynthesizedBuckets
    // where no lastSourceId was set.
    const data: FakeSourceData = {
      members: [{ _id: "m_a", name: "Aria", private: true }],
    };
    const source = createFakeImportSource(data);
    const persister = createFakePersister({
      throwOn: { "synthetic:public": new ApiSourceTokenRejectedError() },
    });

    const result = await runImport({
      source,
      persister,
      options: { selectedCategories: ALL_CATEGORIES_ON, avatarMode: "skip" },
      onProgress: noopProgress,
    });

    expect(result.outcome).toBe("aborted");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.fatal).toBe(true);
    // No members were processed (aborted during synthesis).
    expect(persister.upserted.filter((e) => e.entityType === "member")).toHaveLength(0);
  });
});
