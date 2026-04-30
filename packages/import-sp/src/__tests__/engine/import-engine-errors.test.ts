import { describe, expect, it } from "vitest";

import { buildPersistableEntity, runImport } from "../../engine/import-engine.js";
import { ApiSourceTokenRejectedError } from "../../sources/api-source.js";
import { createFakeImportSource, type FakeSourceData } from "../../sources/fake-source.js";
import {
  ALL_CATEGORIES_ON,
  createFakePersister,
  noopProgress,
} from "../helpers/import-engine-fixtures.js";

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
