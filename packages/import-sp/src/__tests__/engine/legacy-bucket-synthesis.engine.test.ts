/**
 * Integration test: legacy privacy-bucket synthesis.
 *
 * SP exports produced by older app versions do not include a `privacyBuckets`
 * collection at all — members encode privacy via the `private` /
 * `preventTrusted` boolean pair instead. The engine detects this at member
 * collection entry and synthesizes three legacy buckets
 * (`synthetic:public`, `synthetic:trusted`, `synthetic:private`) so members
 * can resolve their bucket source IDs downstream.
 *
 * This test drives the engine against `legacy-no-buckets.sp-export.json` and
 * asserts:
 *   - All three synthetic buckets land in the store.
 *   - Each member's mapped payload carries the bucket source IDs predicted
 *     by `deriveBucketSourceIds` for its privacy flags.
 *   - The run completes cleanly with no recorded errors.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { emptyCheckpointState } from "../../engine/checkpoint.js";
import { collectionToEntityType } from "../../engine/entity-type-map.js";
import { runImport } from "../../engine/import-engine.js";
import { createFakeImportSource } from "../../sources/fake-source.js";
import { createFileImportSource } from "../../sources/file-source.js";
import { createInMemoryPersister } from "../helpers/in-memory-persister.js";

import type { MappedMemberOutput } from "../../mappers/member.mapper.js";

const TEST_FILE_DIR = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(
  TEST_FILE_DIR,
  "..",
  "..",
  "..",
  "test-fixtures",
  "legacy-no-buckets.sp-export.json",
);

describe("import engine — legacy bucket synthesis", () => {
  it("synthesizes public/trusted/private buckets and derives per-member bucket ids", async () => {
    const bytes = new Uint8Array(readFileSync(FIXTURE_PATH));
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    });
    const source = createFileImportSource({ stream });
    const { persister, snapshot } = createInMemoryPersister();

    const result = await runImport({
      source,
      persister,
      initialCheckpoint: emptyCheckpointState({
        firstEntityType: collectionToEntityType("users"),
        selectedCategories: {},
        avatarMode: "skip",
      }),
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: () => Promise.resolve(),
    });
    await source.close();

    expect(result.outcome).toBe("completed");
    expect(result.errors).toHaveLength(0);

    const state = snapshot();

    // All three synthesized buckets were persisted under their synthetic
    // source ids. The in-memory persister does not de-dupe buckets by name,
    // so each synthetic id must be distinct.
    const publicBucket = state.find("privacy-bucket", "synthetic:public");
    const trustedBucket = state.find("privacy-bucket", "synthetic:trusted");
    const privateBucket = state.find("privacy-bucket", "synthetic:private");
    expect(publicBucket).toBeDefined();
    expect(trustedBucket).toBeDefined();
    expect(privateBucket).toBeDefined();
    expect(state.countByType("privacy-bucket")).toBe(3);

    // All four members from the fixture were persisted.
    expect(state.countByType("member")).toBe(4);

    // Each member carries the *resolved* Pluralscape bucket IDs derived from
    // its legacy privacy flags. See `deriveBucketSourceIds` in
    // `member.mapper.ts`, then resolved via `ctx.translate(...)`.
    const memberPrivate = state.find("member", "m_00000001")?.payload as MappedMemberOutput;
    const memberPrevented = state.find("member", "m_00000002")?.payload as MappedMemberOutput;
    const memberPublic = state.find("member", "m_00000003")?.payload as MappedMemberOutput;
    const memberDefault = state.find("member", "m_00000004")?.payload as MappedMemberOutput;

    // Look up the resolved Pluralscape IDs for each synthesized bucket so we
    // can compare the member's `bucketIds` against the actual FK values.
    const publicPsId = publicBucket?.pluralscapeEntityId;
    const trustedPsId = trustedBucket?.pluralscapeEntityId;
    const privatePsId = privateBucket?.pluralscapeEntityId;
    expect(publicPsId).toBeDefined();
    expect(trustedPsId).toBeDefined();
    expect(privatePsId).toBeDefined();

    expect(memberPrivate.bucketIds).toEqual([privatePsId]);
    expect(memberPrevented.bucketIds).toEqual([publicPsId]);
    expect(memberPublic.bucketIds).toEqual([publicPsId, trustedPsId]);
    // Fail-closed default when no privacy info is present.
    expect(memberDefault.bucketIds).toEqual([privatePsId]);

    // The downstream fronting session for memberPrivate should have resolved
    // its FK against the persisted member — confirming the engine processes
    // legacy-synthesis members just like modern ones.
    expect(state.countByType("fronting-session")).toBe(1);
  });
});

describe("synthesized bucket count and flush", () => {
  // Critical #1: synthesized buckets must be counted in checkpoint totals.
  // `persistSynthesizedBuckets` returns an `AdvanceDelta` that is threaded
  // through `advanceWithinCollection` before the member loop starts.
  it("advances totals.perCollection['privacy-bucket'] after synthesis", async () => {
    const source = createFakeImportSource({
      members: [{ _id: "sp_m_1", name: "Alex", private: true }],
    });
    const { persister } = createInMemoryPersister();

    const result = await runImport({
      source,
      persister,
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: () => Promise.resolve(),
    });

    expect(result.finalState.totals.perCollection["privacy-bucket"]).toBeDefined();
    expect(result.finalState.totals.perCollection["privacy-bucket"]?.imported).toBe(3);
  });

  // Critical #2: synthesized buckets must be explicitly flushed after
  // persistence (T30) so a crash-resume can rely on them being durable. The
  // source contains ONLY a members collection — no privacyBuckets — so the
  // only flushes that can fire are those the engine triggers itself. This
  // removes the ambiguity in the prior test, which asserted `flushCount >= 1`
  // before the first member upsert, a condition already guaranteed by
  // incidental prior-collection flushes even without T30.
  //
  // The correct invariant is a strict ordering: all three synthetic
  // privacy-bucket upserts complete → flush → first member upsert. We capture
  // this as an ordered event log and assert:
  //   1. At least one flush fires before the first member upsert.
  //   2. All three privacy-bucket upserts precede that first flush (proving
  //      the flush is the post-synthesis durability flush, not a later one).
  it("synthesized bucket count and flush: buckets are flushed before first member upsert", async () => {
    const source = createFakeImportSource({
      members: [{ _id: "sp_m_1", name: "Alex", private: true }],
    });
    const events: Array<"flush" | { upsert: string }> = [];
    const { persister: inner } = createInMemoryPersister();
    const trackingPersister: import("../../persistence/persister.types.js").Persister = {
      upsertEntity(entity: Parameters<typeof inner.upsertEntity>[0]) {
        events.push({ upsert: entity.entityType });
        return inner.upsertEntity(entity);
      },
      recordError(error: Parameters<typeof inner.recordError>[0]) {
        return inner.recordError(error);
      },
      flush() {
        events.push("flush");
        return inner.flush();
      },
    };

    await runImport({
      source,
      persister: trackingPersister,
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: () => Promise.resolve(),
    });

    const firstMemberIdx = events.findIndex((e) => typeof e === "object" && e.upsert === "member");
    expect(firstMemberIdx).toBeGreaterThan(-1); // sanity: member was upserted

    // At least one flush precedes the first member upsert.
    const flushesBeforeFirstMember = events
      .slice(0, firstMemberIdx)
      .filter((e) => e === "flush").length;
    expect(flushesBeforeFirstMember).toBeGreaterThanOrEqual(1);

    // The three synthetic privacy-bucket upserts all precede the first member
    // upsert — and crucially, there is at least one flush BETWEEN the last
    // bucket upsert and the first member upsert. That flush is the explicit
    // post-synthesis durability flush added by T30. Without T30, buckets would
    // be upserted and then the member loop would start immediately with no
    // intervening flush.
    const lastBucketIdx = events.reduce((acc, e, i) => {
      return typeof e === "object" && e.upsert === "privacy-bucket" ? i : acc;
    }, -1);
    expect(lastBucketIdx).toBeGreaterThan(-1); // sanity: buckets were synthesized

    const flushBetweenBucketAndMember = events
      .slice(lastBucketIdx + 1, firstMemberIdx)
      .filter((e) => e === "flush").length;
    expect(flushBetweenBucketAndMember).toBeGreaterThanOrEqual(1);
  });
});
