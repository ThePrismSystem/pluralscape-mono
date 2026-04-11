import { existsSync } from "node:fs";
import path from "node:path";

import { describe, it, expect, beforeAll } from "vitest";

import { runImport } from "../../engine/import-engine.js";

import {
  COLLECTION_TO_ENTITY_TYPE,
  createApiSource,
  createFileSource,
  findByRef,
  loadManifest,
  makeInitialCheckpoint,
} from "./helpers.js";
import { createRecordingPersister } from "./recording-persister.js";

import type { Manifest, ManifestCollectionKey } from "./manifest.types.js";
import type { RecordingSnapshot } from "./recording-persister.js";
import type { ImportDataSource } from "../../sources/source.types.js";
import type { ImportCheckpointState } from "@pluralscape/types";

const MONOREPO_ROOT = path.resolve(import.meta.dirname, "../../../../..");

// ---------------------------------------------------------------------------
// Guard helpers
// ---------------------------------------------------------------------------

function hasApiTokens(): boolean {
  return (
    typeof process.env["SP_TEST_MINIMAL_API_KEY"] === "string" &&
    process.env["SP_TEST_MINIMAL_API_KEY"].length > 0 &&
    typeof process.env["SP_TEST_ADVERSARIAL_API_KEY"] === "string" &&
    process.env["SP_TEST_ADVERSARIAL_API_KEY"].length > 0
  );
}

function hasExportFixtures(): boolean {
  return (
    existsSync(path.join(MONOREPO_ROOT, "scripts/.sp-test-minimal-export.json")) &&
    existsSync(path.join(MONOREPO_ROOT, "scripts/.sp-test-adversarial-export.json"))
  );
}

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

function assertEntityCounts(snap: RecordingSnapshot, manifest: Manifest): void {
  const keys = Object.keys(COLLECTION_TO_ENTITY_TYPE) as ManifestCollectionKey[];
  for (const key of keys) {
    const entityType = COLLECTION_TO_ENTITY_TYPE[key];
    // Privacy buckets are a special case: SP auto-creates default buckets
    // ("Friends", "Trusted friends") when an account is first provisioned,
    // and the seeder only tracks the buckets it explicitly POSTs. The
    // importer correctly imports every bucket in the export, so the snap
    // count can exceed the manifest count by the number of SP defaults.
    // We enforce "at least the manifest count" here and rely on
    // `assertAllEntitiesPresent` to verify every manifest entry was
    // imported.
    if (entityType === "privacy-bucket") {
      expect(
        snap.count(entityType),
        `${entityType}: imported count must cover every manifest entry`,
      ).toBeGreaterThanOrEqual(manifest[key].length);
      continue;
    }
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

/**
 * Spot-check a few entity payloads to verify field mapping correctness.
 * Checks that key fields from the manifest survived import into the payload.
 */
/**
 * The member mapper wraps the core member fields inside a `member` sub-object
 * (alongside `fieldValues` and `bucketIds`). This helper navigates that
 * structure for payload spot-checks.
 */
function memberName(payload: unknown): unknown {
  if (payload === null || typeof payload !== "object") return undefined;
  const outer = payload as Record<string, unknown>;
  const inner = outer["member"];
  if (inner === null || typeof inner !== "object") return undefined;
  return (inner as Record<string, unknown>)["name"];
}

function assertPayloadSpotChecks(
  snap: RecordingSnapshot,
  manifest: Manifest,
  mode: "minimal" | "adversarial",
): void {
  // Check first member has a payload with a name field
  const firstMember = manifest.members[0];
  if (firstMember) {
    const entity = snap.find("member", firstMember.sourceId);
    if (!entity) {
      throw new Error(`first member entity should exist (sourceId=${firstMember.sourceId})`);
    }
    expect(entity.payload).toBeDefined();
    expect(memberName(entity.payload)).toBe(firstMember.fields["name"]);
  }

  // Check first custom front has a payload
  const firstCustomFront = manifest.customFronts[0];
  if (firstCustomFront) {
    const entity = snap.find("custom-front", firstCustomFront.sourceId);
    if (!entity) {
      throw new Error(
        `first custom front entity should exist (sourceId=${firstCustomFront.sourceId})`,
      );
    }
    expect(entity.payload).toBeDefined();
  }

  // Check first note has a payload with a title field
  const firstNote = manifest.notes[0];
  if (firstNote) {
    const entity = snap.find("journal-entry", firstNote.sourceId);
    if (!entity) {
      throw new Error(`first note entity should exist (sourceId=${firstNote.sourceId})`);
    }
    expect(entity.payload).toBeDefined();
    const payload = entity.payload as Record<string, unknown>;
    expect(payload["title"]).toBe(firstNote.fields["title"]);
  }

  // Ref-based lookup: verify the well-known `member.alice` ref resolves to
  // a member entity whose payload matches the fixture. Minimal mode must
  // contain this ref — a missing entry indicates seeder/test drift, not an
  // expected skip. Adversarial mode may omit it.
  const aliceEntry = findByRef(manifest, "member.alice");
  if (mode === "minimal") {
    expect(aliceEntry, "minimal fixture must include member.alice ref").toBeDefined();
  }
  if (aliceEntry) {
    const entity = snap.find("member", aliceEntry.sourceId);
    if (!entity) {
      throw new Error(`member.alice entity should exist (sourceId=${aliceEntry.sourceId})`);
    }
    expect(entity.payload).toBeDefined();
    expect(memberName(entity.payload)).toBe(aliceEntry.fields["name"]);
  }
}

// ---------------------------------------------------------------------------
// Shared no-op progress callback
// ---------------------------------------------------------------------------

function noopProgress(): Promise<void> {
  return Promise.resolve();
}

// ---------------------------------------------------------------------------
// Parameterized import suite
// ---------------------------------------------------------------------------

type SourceFactory = (
  mode: "minimal" | "adversarial",
  manifest: Manifest,
) => ImportDataSource | Promise<ImportDataSource>;

function defineImportSuite(
  label: string,
  mode: "minimal" | "adversarial",
  sourceFactory: SourceFactory,
): void {
  describe(label, () => {
    let manifest: Manifest;
    let snap: RecordingSnapshot;
    let outcome: string;
    let fatalErrors: number;

    beforeAll(async () => {
      manifest = await loadManifest(mode);
      const source = await sourceFactory(mode, manifest);
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

    it("entity payloads contain expected fields", () => {
      assertPayloadSpotChecks(snap, manifest, mode);
    });
  });
}

// ---------------------------------------------------------------------------
// 1. API Source tests
// ---------------------------------------------------------------------------

describe.skipIf(!hasApiTokens())("SP Import E2E — API Source", () => {
  describe("ApiSource connectivity", () => {
    it("lists the collections the api source can fetch via bulk GET", async () => {
      const manifest = await loadManifest("minimal");
      const source = createApiSource("minimal", manifest);
      try {
        const collections = await source.listCollections();
        // The api source reports only collections with a usable bulk/single
        // endpoint — the per-parent-traversal collections (comments, notes,
        // chatMessages, boardMessages) are intentionally omitted and imported
        // only via the file source. See api-source.ts for the strategy map.
        const expected = [
          "users",
          "private",
          "privacyBuckets",
          "customFields",
          "frontStatuses",
          "members",
          "groups",
          "frontHistory",
          "polls",
          "channelCategories",
          "channels",
        ];
        for (const name of expected) {
          expect(collections, `missing collection ${name}`).toContain(name);
        }
      } finally {
        await source.close();
      }
    });
  });

  defineImportSuite("minimal account — full import", "minimal", createApiSource);
  defineImportSuite("adversarial account — full import", "adversarial", createApiSource);
});

// ---------------------------------------------------------------------------
// 2. File Source tests
// ---------------------------------------------------------------------------

describe.skipIf(!hasExportFixtures())("SP Import E2E — File Source", () => {
  defineImportSuite("minimal export — full import", "minimal", createFileSource);
  defineImportSuite("adversarial export — full import", "adversarial", createFileSource);
});

// ---------------------------------------------------------------------------
// 3. Checkpoint Resume tests
// ---------------------------------------------------------------------------

describe.skipIf(!hasExportFixtures())("SP Import E2E — Checkpoint Resume", () => {
  it("resumes from an aborted checkpoint and completes", async () => {
    const manifest = await loadManifest("minimal");
    const source = await createFileSource("minimal", manifest);
    const recorder = createRecordingPersister();

    // First: run a full import to establish baseline.
    const fullResult = await runImport({
      source: await createFileSource("minimal", manifest),
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
      source: await createFileSource("minimal", manifest),
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
    if (!abortedCheckpoint) {
      throw new Error("abort checkpoint was not captured");
    }

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
