import { existsSync } from "node:fs";
import path from "node:path";

import { describe, it, expect, beforeAll } from "vitest";

import { runImport } from "../../engine/import-engine.js";
import { SP_COLLECTION_NAMES } from "../../sources/sp-collections.js";

import {
  COLLECTION_TO_ENTITY_TYPE,
  createApiSource,
  createFileSource,
  loadManifest,
  makeInitialCheckpoint,
} from "./helpers.js";
import { createRecordingPersister } from "./recording-persister.js";

import type { Manifest, ManifestCollectionKey } from "./manifest.types.js";
import type { RecordingSnapshot } from "./recording-persister.js";
import type { ImportCheckpointState } from "@pluralscape/types";

const MONOREPO_ROOT = path.resolve(import.meta.dirname, "../../../../..");

// ---------------------------------------------------------------------------
// Guard helpers
// ---------------------------------------------------------------------------

function hasApiTokens(): boolean {
  return (
    typeof process.env["SP_TEST_MINIMAL_TOKEN"] === "string" &&
    process.env["SP_TEST_MINIMAL_TOKEN"].length > 0 &&
    typeof process.env["SP_TEST_ADVERSARIAL_TOKEN"] === "string" &&
    process.env["SP_TEST_ADVERSARIAL_TOKEN"].length > 0
  );
}

function hasExportFixtures(): boolean {
  return (
    existsSync(path.join(MONOREPO_ROOT, "scripts/fixtures/sp-test-minimal-export.json")) &&
    existsSync(path.join(MONOREPO_ROOT, "scripts/fixtures/sp-test-adversarial-export.json"))
  );
}

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

function assertEntityCounts(snap: RecordingSnapshot, manifest: Manifest): void {
  const keys = Object.keys(COLLECTION_TO_ENTITY_TYPE) as ManifestCollectionKey[];
  for (const key of keys) {
    const entityType = COLLECTION_TO_ENTITY_TYPE[key];
    expect(snap.count(entityType), `count mismatch for ${entityType}`).toBe(manifest[key].length);
  }
}

function assertAllEntitiesPresent(snap: RecordingSnapshot, manifest: Manifest): void {
  const keys = Object.keys(COLLECTION_TO_ENTITY_TYPE) as ManifestCollectionKey[];
  for (const key of keys) {
    const entityType = COLLECTION_TO_ENTITY_TYPE[key];
    for (const entry of manifest[key]) {
      expect(
        snap.find(entityType, entry.sourceId),
        `missing ${entityType} with sourceId ${entry.sourceId}`,
      ).toBeDefined();
    }
  }
}

// ---------------------------------------------------------------------------
// Shared no-op progress callback
// ---------------------------------------------------------------------------

function noopProgress(): Promise<void> {
  return Promise.resolve();
}

// ---------------------------------------------------------------------------
// 1. API Source tests
// ---------------------------------------------------------------------------

describe.skipIf(!hasApiTokens())("SP Import E2E — API Source", () => {
  describe("ApiSource connectivity", () => {
    it("lists all known SP collection names", async () => {
      const source = createApiSource("minimal");
      try {
        const collections = await source.listCollections();
        for (const name of SP_COLLECTION_NAMES) {
          expect(collections, `missing collection ${name}`).toContain(name);
        }
      } finally {
        await source.close();
      }
    });
  });

  describe("minimal account — full import", () => {
    let manifest: Manifest;
    let snap: RecordingSnapshot;
    let outcome: string;
    let fatalErrors: number;

    beforeAll(async () => {
      manifest = await loadManifest("minimal");
      const source = createApiSource("minimal");
      const recorder = createRecordingPersister();
      const result = await runImport({
        source,
        persister: recorder.persister,
        initialCheckpoint: makeInitialCheckpoint(),
        options: { selectedCategories: {}, avatarMode: "skip" },
        onProgress: noopProgress,
      });
      outcome = result.outcome;
      fatalErrors = result.errors.filter((e) => e.fatal).length;
      snap = recorder.snapshot();
    });

    it("completes without aborting", () => {
      expect(outcome).toBe("completed");
    });

    it("produces zero fatal errors", () => {
      expect(fatalErrors).toBe(0);
    });

    it("entity counts match manifest", () => {
      assertEntityCounts(snap, manifest);
    });

    it("every manifest source ID has a recorded entity", () => {
      assertAllEntitiesPresent(snap, manifest);
    });
  });

  describe("adversarial account — full import", () => {
    let manifest: Manifest;
    let snap: RecordingSnapshot;
    let outcome: string;
    let fatalErrors: number;

    beforeAll(async () => {
      manifest = await loadManifest("adversarial");
      const source = createApiSource("adversarial");
      const recorder = createRecordingPersister();
      const result = await runImport({
        source,
        persister: recorder.persister,
        initialCheckpoint: makeInitialCheckpoint(),
        options: { selectedCategories: {}, avatarMode: "skip" },
        onProgress: noopProgress,
      });
      outcome = result.outcome;
      fatalErrors = result.errors.filter((e) => e.fatal).length;
      snap = recorder.snapshot();
    });

    it("completes without aborting", () => {
      expect(outcome).toBe("completed");
    });

    it("produces zero fatal errors", () => {
      expect(fatalErrors).toBe(0);
    });

    it("entity counts match manifest", () => {
      assertEntityCounts(snap, manifest);
    });

    it("every manifest source ID has a recorded entity", () => {
      assertAllEntitiesPresent(snap, manifest);
    });
  });
});

// ---------------------------------------------------------------------------
// 2. File Source tests
// ---------------------------------------------------------------------------

describe.skipIf(!hasExportFixtures())("SP Import E2E — File Source", () => {
  describe("minimal export — full import", () => {
    let manifest: Manifest;
    let snap: RecordingSnapshot;
    let outcome: string;
    let fatalErrors: number;

    beforeAll(async () => {
      manifest = await loadManifest("minimal");
      const source = await createFileSource("minimal");
      const recorder = createRecordingPersister();
      const result = await runImport({
        source,
        persister: recorder.persister,
        initialCheckpoint: makeInitialCheckpoint(),
        options: { selectedCategories: {}, avatarMode: "skip" },
        onProgress: noopProgress,
      });
      outcome = result.outcome;
      fatalErrors = result.errors.filter((e) => e.fatal).length;
      snap = recorder.snapshot();
    });

    it("completes without aborting", () => {
      expect(outcome).toBe("completed");
    });

    it("produces zero fatal errors", () => {
      expect(fatalErrors).toBe(0);
    });

    it("entity counts match manifest", () => {
      assertEntityCounts(snap, manifest);
    });

    it("every manifest source ID has a recorded entity", () => {
      assertAllEntitiesPresent(snap, manifest);
    });
  });

  describe("adversarial export — full import", () => {
    let manifest: Manifest;
    let snap: RecordingSnapshot;
    let outcome: string;
    let fatalErrors: number;

    beforeAll(async () => {
      manifest = await loadManifest("adversarial");
      const source = await createFileSource("adversarial");
      const recorder = createRecordingPersister();
      const result = await runImport({
        source,
        persister: recorder.persister,
        initialCheckpoint: makeInitialCheckpoint(),
        options: { selectedCategories: {}, avatarMode: "skip" },
        onProgress: noopProgress,
      });
      outcome = result.outcome;
      fatalErrors = result.errors.filter((e) => e.fatal).length;
      snap = recorder.snapshot();
    });

    it("completes without aborting", () => {
      expect(outcome).toBe("completed");
    });

    it("produces zero fatal errors", () => {
      expect(fatalErrors).toBe(0);
    });

    it("entity counts match manifest", () => {
      assertEntityCounts(snap, manifest);
    });

    it("every manifest source ID has a recorded entity", () => {
      assertAllEntitiesPresent(snap, manifest);
    });
  });
});

// ---------------------------------------------------------------------------
// 3. Checkpoint Resume tests
// ---------------------------------------------------------------------------

describe.skipIf(!hasExportFixtures())("SP Import E2E — Checkpoint Resume", () => {
  it("resumes from an aborted checkpoint and completes", async () => {
    const source = await createFileSource("minimal");
    const recorder = createRecordingPersister();

    // First: run a full import to establish baseline.
    const fullResult = await runImport({
      source: await createFileSource("minimal"),
      persister: recorder.persister,
      initialCheckpoint: makeInitialCheckpoint(),
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
    });
    expect(fullResult.outcome).toBe("completed");

    // Second: run an import that aborts after 3 progress callbacks.
    const abortController = new AbortController();
    let progressCount = 0;
    const ABORT_AFTER_PROGRESS = 3;
    let abortedCheckpoint: ImportCheckpointState | undefined;

    const abortRecorder = createRecordingPersister();
    const abortResult = await runImport({
      source: await createFileSource("minimal"),
      persister: abortRecorder.persister,
      initialCheckpoint: makeInitialCheckpoint(),
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: (state) => {
        progressCount += 1;
        if (progressCount >= ABORT_AFTER_PROGRESS) {
          abortedCheckpoint = state;
          abortController.abort();
        }
        return Promise.resolve();
      },
      abortSignal: abortController.signal,
    });
    expect(abortResult.outcome).toBe("aborted");
    expect(abortedCheckpoint).toBeDefined();

    // Third: resume from the aborted checkpoint.
    const resumeRecorder = createRecordingPersister();
    const resumeResult = await runImport({
      source,
      persister: resumeRecorder.persister,
      initialCheckpoint: abortedCheckpoint,
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
    });

    expect(resumeResult.outcome).toBe("completed");
    expect(resumeResult.errors.filter((e) => e.fatal)).toHaveLength(0);
  });
});
