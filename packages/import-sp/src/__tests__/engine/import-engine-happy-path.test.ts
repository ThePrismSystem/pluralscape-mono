import { describe, expect, it } from "vitest";

import { collectionToEntityType } from "../../engine/entity-type-map.js";
import { runImport } from "../../engine/import-engine.js";
import { createFakeImportSource, type FakeSourceData } from "../../sources/fake-source.js";
import {
  ALL_CATEGORIES_ON,
  createFakePersister,
  noopProgress,
  stubSource,
} from "../helpers/import-engine-fixtures.js";

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
    expect(persister.upserted.some((e) => e.entityType === "fronting-session")).toBe(true);
    expect(persister.upserted.some((e) => e.entityType === "member")).toBe(true);
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
    expect(unkWarning?.entityType).toBe("member");
  });
});
