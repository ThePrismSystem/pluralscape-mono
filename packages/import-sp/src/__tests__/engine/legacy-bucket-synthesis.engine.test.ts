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
    const source = await createFileImportSource({ jsonBytes: bytes });
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

    // Each member carries the bucket source ids derived from its legacy
    // privacy flags. See `deriveBucketSourceIds` in `member.mapper.ts`.
    const memberPrivate = state.find("member", "m_00000001")?.payload as MappedMemberOutput;
    const memberPrevented = state.find("member", "m_00000002")?.payload as MappedMemberOutput;
    const memberPublic = state.find("member", "m_00000003")?.payload as MappedMemberOutput;
    const memberDefault = state.find("member", "m_00000004")?.payload as MappedMemberOutput;

    expect(memberPrivate.bucketSourceIds).toEqual(["synthetic:private"]);
    expect(memberPrevented.bucketSourceIds).toEqual(["synthetic:public"]);
    expect(memberPublic.bucketSourceIds).toEqual(["synthetic:public", "synthetic:trusted"]);
    // Fail-closed default when no privacy info is present.
    expect(memberDefault.bucketSourceIds).toEqual(["synthetic:private"]);

    // The downstream fronting session for memberPrivate should have resolved
    // its FK against the persisted member — confirming the engine processes
    // legacy-synthesis members just like modern ones.
    expect(state.countByType("fronting-session")).toBe(1);
  });
});
