import { describe, expect, it } from "vitest";

import { emptyCheckpointState } from "../../engine/checkpoint.js";
import { collectionToEntityType } from "../../engine/entity-type-map.js";
import { runImport } from "../../engine/import-engine.js";
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
