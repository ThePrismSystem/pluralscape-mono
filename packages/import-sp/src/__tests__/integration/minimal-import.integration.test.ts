/**
 * Integration test: minimal end-to-end SP import.
 *
 * Drives `runImport` against the smallest committed fixture
 * (`test-fixtures/minimal.sp-export.json`) using the real `FileImportSource`
 * and the shared in-memory persister helper. This is the high-level smoke
 * test that every mapper + dispatch + checkpoint integration path works
 * together without any mocking of the engine internals.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { emptyCheckpointState } from "../../engine/checkpoint.js";
import { DEPENDENCY_ORDER } from "../../engine/dependency-order.js";
import { collectionToEntityType } from "../../engine/entity-type-map.js";
import { runImport } from "../../engine/import-engine.js";
import { createFileImportSource } from "../../sources/file-source.js";
import { createInMemoryPersister } from "../helpers/in-memory-persister.js";

const TEST_FILE_DIR = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(
  TEST_FILE_DIR,
  "..",
  "..",
  "..",
  "test-fixtures",
  "minimal.sp-export.json",
);

describe("import engine — minimal end-to-end import", () => {
  it("persists every entity in the minimal fixture and marks every collection complete", async () => {
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

    // Outcome: clean completion, no errors, no fatal failures.
    expect(result.outcome).toBe("completed");
    expect(result.errors).toHaveLength(0);

    const state = snapshot();

    // Per-entity counts reflect exactly what the minimal fixture declares:
    // 1 privacy bucket, 1 field definition, 1 member, 1 fronting session.
    expect(state.countByType("privacy-bucket")).toBe(1);
    expect(state.countByType("field-definition")).toBe(1);
    expect(state.countByType("member")).toBe(1);
    expect(state.countByType("fronting-session")).toBe(1);

    // Collections absent from the fixture must not appear in the store.
    expect(state.countByType("group")).toBe(0);
    expect(state.countByType("custom-front")).toBe(0);
    expect(state.countByType("journal-entry")).toBe(0);

    // Each upserted entity has a deterministic pluralscape id assigned by the
    // in-memory persister, so FK lookups work.
    const bucket = state.find("privacy-bucket", "bk_00000001");
    const fieldDef = state.find("field-definition", "cf_00000001");
    const member = state.find("member", "m_00000001");
    const session = state.find("fronting-session", "fh_00000001");
    expect(bucket).toBeDefined();
    expect(fieldDef).toBeDefined();
    expect(member).toBeDefined();
    expect(session).toBeDefined();

    // Every collection in DEPENDENCY_ORDER is visited and marked as completed
    // on a clean run, even when the source has no documents for it.
    const expectedCompleted = DEPENDENCY_ORDER.map((c) => collectionToEntityType(c));
    for (const entityType of expectedCompleted) {
      expect(result.finalState.checkpoint.completedCollections).toContain(entityType);
    }

    // Checkpoint lands with the last completed collection as `currentCollection`
    // (the engine advances past the last one after the loop exits).
    expect(result.finalState.checkpoint.currentCollection).toBe(
      collectionToEntityType("pendingFriendRequests"),
    );

    // Flush is called at least once per collection — DEPENDENCY_ORDER has
    // 17 entries, so we expect at least 17 flushes for a clean run.
    expect(state.flushCount).toBeGreaterThanOrEqual(DEPENDENCY_ORDER.length);
  });
});
