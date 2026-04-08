import { describe, expect, it } from "vitest";

import { collectionToEntityType } from "../../engine/entity-type-map.js";
import { runImport } from "../../engine/import-engine.js";
import { createFakeImportSource, type FakeSourceData } from "../../sources/fake-source.js";

import type { Persister, PersistableEntity } from "../../persistence/persister.types.js";
import type { ImportError } from "@pluralscape/types";

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
