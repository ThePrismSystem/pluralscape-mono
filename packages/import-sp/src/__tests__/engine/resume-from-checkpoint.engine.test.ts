/**
 * Integration test: resume from a mid-collection checkpoint.
 *
 * Seeds a checkpoint with `currentCollection: member` and
 * `currentCollectionLastSourceId: m_00000005`, then runs the engine against
 * a tailored fixture.  The engine must:
 *
 *   1. Skip every collection earlier than `member` in the dependency order.
 *      These collections must not contribute to `totals.perCollection` because
 *      their iteration is entirely bypassed.
 *   2. Fast-forward iteration within `member` past the checkpointed source id,
 *      persisting only members whose source ids come after `m_00000005` in
 *      insertion order (`m_00000006` through `m_00000010`).
 *   3. Continue processing every collection after `member` normally.
 *
 * The fixture is built inline rather than pulled from disk so every
 * downstream entity can be pinned to a member that WILL be reached after
 * resume — otherwise downstream FK resolution would fail for entries
 * referencing the skipped members 1..5 and muddy the test.
 */
import { describe, expect, it } from "vitest";

import { DEPENDENCY_ORDER } from "../../engine/dependency-order.js";
import { collectionToEntityType } from "../../engine/entity-type-map.js";
import { runImport } from "../../engine/import-engine.js";
import { createFileImportSource } from "../../sources/file-source.js";
import { createInMemoryPersister } from "../helpers/in-memory-persister.js";

import type { ImportCheckpointState, ImportCollectionType } from "@pluralscape/types";

const RESUME_CUTOFF_SOURCE_ID = "m_00000005";
const TOTAL_MEMBERS_IN_FIXTURE = 10;
const RESUME_CUTOFF_INDEX = 5;
const EXPECTED_RESUMED_MEMBERS = TOTAL_MEMBERS_IN_FIXTURE - RESUME_CUTOFF_INDEX;
const SESSIONS_AFTER_CUTOFF = 3;
const FIXTURE_BASE_TIME = 1_700_000_000_000;
const ID_PAD_WIDTH = 8;

/**
 * Build the resume-test fixture.  Members 1..10 are identical shells using
 * legacy SP privacy flags (`private: true`) rather than modern `buckets`
 * references; this lets the engine's legacy-bucket-synthesis path hydrate
 * the in-run translation table with the three synthetic buckets during the
 * resumed member pass so bucket FK resolution can succeed. All downstream
 * collections reference `m_00000010`, which is guaranteed to be present
 * both in a clean run and in the mid-collection resume because it comes
 * after the cutoff.
 */
function buildResumeFixture(): Uint8Array {
  const members = Array.from({ length: TOTAL_MEMBERS_IN_FIXTURE }, (_, i) => ({
    _id: `m_${String(i + 1).padStart(ID_PAD_WIDTH, "0")}`,
    name: `Member ${String(i + 1)}`,
    private: true,
  }));
  const lastMemberId = members[members.length - 1]?._id ?? "m_00000010";
  const sessions = Array.from({ length: SESSIONS_AFTER_CUTOFF }, (_, i) => ({
    _id: `fh_${String(i + 1).padStart(ID_PAD_WIDTH, "0")}`,
    member: lastMemberId,
    custom: false,
    live: i === SESSIONS_AFTER_CUTOFF - 1,
    startTime: FIXTURE_BASE_TIME + i * 1_000,
    endTime: i === SESSIONS_AFTER_CUTOFF - 1 ? null : FIXTURE_BASE_TIME + i * 1_000 + 500,
  }));
  // Omit `privacyBuckets` so legacy synthesis fires on the resumed run.
  const data = {
    members,
    groups: [{ _id: "g_00000001", name: "Pod Omega", members: [lastMemberId] }],
    frontHistory: sessions,
  };
  return new TextEncoder().encode(JSON.stringify(data));
}

/**
 * Build a checkpoint state that signals "mid-member, last processed id was
 * m_00000005". `completedCollections` is populated with every entity type
 * preceding `member` (so those iterations are skipped entirely) but NOT
 * `"member"` itself — the member loop is still running. Leaving `"member"`
 * out also lets legacy-bucket synthesis fire on resume so the in-memory
 * translation table gets hydrated with the synthetic privacy buckets that
 * the resumed members will resolve against.
 */
function buildMidMemberCheckpoint(): ImportCheckpointState {
  const memberIndex = DEPENDENCY_ORDER.indexOf("members");
  const completedCollections: readonly ImportCollectionType[] = DEPENDENCY_ORDER.slice(
    0,
    memberIndex,
  ).map((c) => collectionToEntityType(c));
  return {
    schemaVersion: 2,
    checkpoint: {
      completedCollections,
      currentCollection: "member",
      currentCollectionLastSourceId: RESUME_CUTOFF_SOURCE_ID,
      // Resume-before-members fixture has no real privacy buckets persisted
      // yet — synthesis must fire on resume so members resolve their
      // `synthetic:*` references. Matches the comment above this builder.
      realPrivacyBucketsMapped: false,
    },
    options: { selectedCategories: {}, avatarMode: "skip" },
    totals: { perCollection: {} },
  };
}

describe("import engine — resume from mid-collection checkpoint", () => {
  it("skips pre-member collections entirely and resumes member iteration past the cutoff", async () => {
    const fixtureBytes = buildResumeFixture();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(fixtureBytes);
        controller.close();
      },
    });
    const source = createFileImportSource({ stream });
    const { persister, snapshot } = createInMemoryPersister();

    const result = await runImport({
      source,
      persister,
      initialCheckpoint: buildMidMemberCheckpoint(),
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: () => Promise.resolve(),
    });
    await source.close();

    expect(result.outcome).toBe("completed");
    expect(result.errors).toHaveLength(0);

    const state = snapshot();

    // Collections earlier than `member` in DEPENDENCY_ORDER are entirely
    // skipped — no upserts into the store and no totals recorded — EXCEPT
    // for privacy-bucket, which is re-synthesized on resume because the
    // in-memory ID translation table does not survive across runs. Legacy
    // bucket synthesis runs before the member loop so the resumed members
    // (1..10 using `private: true`) can resolve their synthetic bucket
    // references.
    expect(state.countByType("system-profile")).toBe(0);
    expect(state.countByType("system-settings")).toBe(0);
    expect(state.countByType("field-definition")).toBe(0);
    expect(state.countByType("custom-front")).toBe(0);
    // Legacy synthesis re-creates all three buckets.
    expect(state.countByType("privacy-bucket")).toBe(3);
    for (const earlierType of [
      "system-profile",
      "system-settings",
      "field-definition",
      "custom-front",
    ] as const) {
      expect(result.finalState.totals.perCollection[earlierType]).toBeUndefined();
    }
    // Privacy-bucket totals reflect the three synthesized buckets.
    expect(result.finalState.totals.perCollection["privacy-bucket"]?.imported).toBe(3);

    // Only members 6..10 were persisted. Members 1..5 (inclusive of the
    // cutoff) must not appear in the store.
    expect(state.countByType("member")).toBe(EXPECTED_RESUMED_MEMBERS);
    for (let i = 1; i <= RESUME_CUTOFF_INDEX; i += 1) {
      const sourceId = `m_${String(i).padStart(ID_PAD_WIDTH, "0")}`;
      expect(state.find("member", sourceId)).toBeUndefined();
    }
    for (let i = RESUME_CUTOFF_INDEX + 1; i <= TOTAL_MEMBERS_IN_FIXTURE; i += 1) {
      const sourceId = `m_${String(i).padStart(ID_PAD_WIDTH, "0")}`;
      expect(state.find("member", sourceId)?.sourceEntityId).toBe(sourceId);
    }

    // Member totals in the checkpoint reflect only the resumed entities.
    const memberTotals = result.finalState.totals.perCollection.member;
    expect(memberTotals?.total).toBe(EXPECTED_RESUMED_MEMBERS);

    // Post-member collections are still fully processed. Each downstream
    // entity in the inline fixture references `m_00000010`, which WAS
    // persisted during the resumed run.
    expect(state.countByType("group")).toBe(1);
    expect(state.countByType("fronting-session")).toBe(SESSIONS_AFTER_CUTOFF);
  });
});
