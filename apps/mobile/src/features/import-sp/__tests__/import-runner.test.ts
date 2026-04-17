/**
 * Tests for `runSpImport` — the thin mobile orchestrator around the engine's
 * `runImport`. Covers the happy path, fatal aborts, progress callback
 * behaviour, and checkpoint resume threading.
 */

import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { createFakeImportSource } from "@pluralscape/import-sp/fake-source";
import { brandId } from "@pluralscape/types";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { runSpImport } from "../import-runner.js";
import { createMobilePersister } from "../mobile-persister.js";

import {
  makeTestMasterKey,
  NOOP_AVATAR_FETCHER,
  TEST_SOURCE,
  TEST_SYSTEM_ID,
} from "./persister-test-helpers.js";

import type { PersisterApi } from "../persister/persister.types.js";
import type {
  ImportAvatarMode,
  ImportCheckpointState,
  ImportJob,
  ImportJobId,
} from "@pluralscape/types";

const TEST_JOB_ID = brandId<ImportJobId>("ij_test_runner");
const AVATAR_MODE: ImportAvatarMode = "skip";
const ALL_CATEGORIES_SELECTED: Record<string, boolean> = {};

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
});

/**
 * Build a PersisterApi stub whose importEntityRef responds normally but
 * every create call is a no-op returning stable IDs. Used where the runner
 * is under test rather than the persister internals.
 */
function makeQuietApi(): PersisterApi {
  // Re-use the shared factory but override importEntityRef so the test
  // does not need to flush-roundtrip ref batches.
  const api: PersisterApi = {
    system: {
      getCurrentVersion: vi.fn().mockResolvedValue(1),
      update: vi.fn().mockResolvedValue({ id: "sys_1", version: 2 }),
    },
    systemSettings: {
      getCurrentVersion: vi.fn().mockResolvedValue(1),
      update: vi.fn().mockResolvedValue({ id: "sset_1", version: 2 }),
    },
    bucket: {
      create: vi.fn().mockResolvedValue({ id: "bkt_new", version: 1 }),
      update: vi.fn().mockResolvedValue({ id: "bkt_new", version: 2 }),
    },
    field: {
      create: vi.fn().mockResolvedValue({ id: "fld_1", version: 1 }),
      update: vi.fn().mockResolvedValue({ id: "fld_1", version: 2 }),
      setValue: vi.fn().mockResolvedValue({ id: "fv_1", version: 1 }),
    },
    customFront: {
      create: vi.fn().mockResolvedValue({ id: "cf_1", version: 1 }),
      update: vi.fn().mockResolvedValue({ id: "cf_1", version: 2 }),
    },
    member: {
      create: vi.fn().mockResolvedValue({ id: "mem_1", version: 1 }),
      update: vi.fn().mockResolvedValue({ id: "mem_1", version: 2 }),
    },
    friend: {
      recordExternalReference: vi.fn().mockResolvedValue({ placeholderId: "fp_1" }),
    },
    frontingSession: {
      create: vi.fn().mockResolvedValue({ id: "fs_1", version: 1 }),
      update: vi.fn().mockResolvedValue({ id: "fs_1", version: 2 }),
    },
    frontingComment: {
      create: vi.fn().mockResolvedValue({ id: "fcom_1", version: 1 }),
      update: vi.fn().mockResolvedValue({ id: "fcom_1", version: 2 }),
    },
    note: {
      create: vi.fn().mockResolvedValue({ id: "note_1", version: 1 }),
      update: vi.fn().mockResolvedValue({ id: "note_1", version: 2 }),
    },
    poll: {
      create: vi.fn().mockResolvedValue({ id: "poll_1", version: 1 }),
      update: vi.fn().mockResolvedValue({ id: "poll_1", version: 2 }),
      castVote: vi.fn().mockResolvedValue({ id: "pv_1" }),
    },
    channel: {
      create: vi.fn().mockResolvedValue({ id: "ch_1", version: 1 }),
      update: vi.fn().mockResolvedValue({ id: "ch_1", version: 2 }),
    },
    message: {
      create: vi.fn().mockResolvedValue({ id: "msg_1", version: 1 }),
      update: vi.fn().mockResolvedValue({ id: "msg_1", version: 2 }),
    },
    boardMessage: {
      create: vi.fn().mockResolvedValue({ id: "bm_1", version: 1 }),
      update: vi.fn().mockResolvedValue({ id: "bm_1", version: 2 }),
    },
    group: {
      create: vi.fn().mockResolvedValue({ id: "grp_1", version: 1 }),
      update: vi.fn().mockResolvedValue({ id: "grp_1", version: 2 }),
    },
    blob: { uploadAvatar: vi.fn().mockResolvedValue({ blobId: "blob_1" }) },
    importEntityRef: {
      lookupBatch: vi.fn().mockResolvedValue({}),
      upsertBatch: vi.fn().mockResolvedValue({ upserted: 0 }),
    },
  };
  return api;
}

/** Seed the fake source with one privacy bucket so the engine has at least one creatable entity. */
function makeMinimalSourceData(): Parameters<typeof createFakeImportSource>[0] {
  return {
    privacyBuckets: [{ _id: "src_bkt_1", name: "Public", description: null }],
  };
}

describe("runSpImport", () => {
  it("completes successfully and calls updateJobFn with completed status", async () => {
    const api = makeQuietApi();
    const persister = createMobilePersister({
      systemId: TEST_SYSTEM_ID,
      source: TEST_SOURCE,
      masterKey: makeTestMasterKey(),
      api,
      avatarFetcher: NOOP_AVATAR_FETCHER,
      preloadHints: [],
    });

    const updateJobFn = vi.fn().mockResolvedValue(undefined);
    const onProgress = vi.fn();

    const result = await runSpImport({
      source: createFakeImportSource(makeMinimalSourceData()),
      persister,
      importJobId: TEST_JOB_ID,
      options: {
        selectedCategories: ALL_CATEGORIES_SELECTED,
        avatarMode: AVATAR_MODE,
      },
      onProgress,
      updateJobFn,
    });

    expect(result.outcome).toBe("completed");
    // Final completion call should have fired.
    const calls = updateJobFn.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const lastCall = calls[calls.length - 1];
    expect(lastCall?.[0]).toBe(TEST_JOB_ID);
    expect(lastCall?.[1]).toEqual(
      expect.objectContaining({
        status: "completed",
        progressPercent: 100,
      }),
    );
  });

  it("calls onProgress with a snapshot at every chunk boundary", async () => {
    const api = makeQuietApi();
    const persister = createMobilePersister({
      systemId: TEST_SYSTEM_ID,
      source: TEST_SOURCE,
      masterKey: makeTestMasterKey(),
      api,
      avatarFetcher: NOOP_AVATAR_FETCHER,
      preloadHints: [],
    });

    const updateJobFn = vi.fn().mockResolvedValue(undefined);
    const onProgress = vi.fn();

    await runSpImport({
      source: createFakeImportSource(makeMinimalSourceData()),
      persister,
      importJobId: TEST_JOB_ID,
      options: {
        selectedCategories: ALL_CATEGORIES_SELECTED,
        avatarMode: AVATAR_MODE,
      },
      onProgress,
      updateJobFn,
    });

    // onProgress must have been called at least once with a snapshot carrying
    // a checkpointState and current progressPercent.
    expect(onProgress).toHaveBeenCalled();
    const firstCall = onProgress.mock.calls[0];
    const snapshot = firstCall?.[0] as { checkpointState: ImportCheckpointState };
    // A real checkpointState carries schemaVersion and a checkpoint record.
    expect(snapshot.checkpointState.schemaVersion).toBe(1);
    expect(typeof snapshot.checkpointState.checkpoint).toBe("object");
  });

  it("marks the job failed when the source throws a fatal error", async () => {
    const fatalError = new Error("network down");
    const throwingSource: ReturnType<typeof createFakeImportSource> = {
      mode: "fake",
      async *iterate() {
        await Promise.resolve();
        throw fatalError;
      },
      listCollections: () => Promise.resolve([]),
      close: () => Promise.resolve(),
    };

    const api = makeQuietApi();
    const persister = createMobilePersister({
      systemId: TEST_SYSTEM_ID,
      source: TEST_SOURCE,
      masterKey: makeTestMasterKey(),
      api,
      avatarFetcher: NOOP_AVATAR_FETCHER,
      preloadHints: [],
    });

    const updateJobFn = vi.fn().mockResolvedValue(undefined);

    const result = await runSpImport({
      source: throwingSource,
      persister,
      importJobId: TEST_JOB_ID,
      options: {
        selectedCategories: ALL_CATEGORIES_SELECTED,
        avatarMode: AVATAR_MODE,
      },
      updateJobFn,
    });

    expect(result.outcome).toBe("aborted");
    // At least one updateJobFn call must carry status: "failed" and preserve
    // the checkpointState.
    const failingCall = updateJobFn.mock.calls.find(
      (call) => (call[1] as { status?: string } | undefined)?.status === "failed",
    );
    expect(failingCall?.[0]).toBe(TEST_JOB_ID);
    const patch = failingCall?.[1] as Partial<ImportJob> & {
      checkpointState?: ImportCheckpointState | null;
    };
    // checkpointState must be preserved (not wiped) when marking the job failed.
    expect(patch.checkpointState?.schemaVersion).toBe(1);
  });

  it("threads initialCheckpoint into the engine's runImport", async () => {
    const api = makeQuietApi();
    const persister = createMobilePersister({
      systemId: TEST_SYSTEM_ID,
      source: TEST_SOURCE,
      masterKey: makeTestMasterKey(),
      api,
      avatarFetcher: NOOP_AVATAR_FETCHER,
      preloadHints: [],
    });

    const initialCheckpoint: ImportCheckpointState = {
      schemaVersion: 1,
      checkpoint: {
        completedCollections: ["privacy-bucket"],
        currentCollection: "field-definition",
        currentCollectionLastSourceId: null,
      },
      options: {
        selectedCategories: ALL_CATEGORIES_SELECTED,
        avatarMode: AVATAR_MODE,
      },
      totals: { perCollection: {} },
    };

    const updateJobFn = vi.fn().mockResolvedValue(undefined);

    const result = await runSpImport({
      source: createFakeImportSource({}),
      persister,
      importJobId: TEST_JOB_ID,
      options: {
        selectedCategories: ALL_CATEGORIES_SELECTED,
        avatarMode: AVATAR_MODE,
      },
      initialCheckpoint,
      updateJobFn,
    });

    expect(result.outcome).toBe("completed");
    // The engine must have progressed past the resumed collection — the
    // final state's completedCollections should include "privacy-bucket".
    expect(result.finalState.checkpoint.completedCollections).toContain("privacy-bucket");
  });

  it("seeds initial checkpoint before running the engine", async () => {
    const api = makeQuietApi();
    const persister = createMobilePersister({
      systemId: TEST_SYSTEM_ID,
      source: TEST_SOURCE,
      masterKey: makeTestMasterKey(),
      api,
      avatarFetcher: NOOP_AVATAR_FETCHER,
      preloadHints: [],
    });

    const updateJobFn = vi.fn().mockResolvedValue(undefined);
    const avatarMode: ImportAvatarMode = "api";

    await runSpImport({
      source: createFakeImportSource(makeMinimalSourceData()),
      persister,
      importJobId: TEST_JOB_ID,
      options: {
        selectedCategories: ALL_CATEGORIES_SELECTED,
        avatarMode,
      },
      updateJobFn,
    });

    // The very first updateJobFn call must be the seed: status "importing"
    // with a checkpointState that preserves avatarMode.
    const firstCall = updateJobFn.mock.calls[0];
    expect(firstCall?.[0]).toBe(TEST_JOB_ID);
    const patch = firstCall?.[1] as { status?: string; checkpointState?: ImportCheckpointState };
    expect(patch.status).toBe("importing");
    expect(patch.checkpointState?.options.avatarMode).toBe(avatarMode);
  });

  it("does not call terminal updateJobFn when abortSignal is already aborted", async () => {
    const api = makeQuietApi();
    const persister = createMobilePersister({
      systemId: TEST_SYSTEM_ID,
      source: TEST_SOURCE,
      masterKey: makeTestMasterKey(),
      api,
      avatarFetcher: NOOP_AVATAR_FETCHER,
      preloadHints: [],
    });

    const controller = new AbortController();
    controller.abort();

    const updateJobFn = vi.fn().mockResolvedValue(undefined);

    const result = await runSpImport({
      source: createFakeImportSource(makeMinimalSourceData()),
      persister,
      importJobId: TEST_JOB_ID,
      options: {
        selectedCategories: ALL_CATEGORIES_SELECTED,
        avatarMode: AVATAR_MODE,
      },
      updateJobFn,
      abortSignal: controller.signal,
    });

    // Result must be returned without throwing and must carry an outcome.
    expect(result.outcome).toBe("aborted");

    // No terminal call with "completed" or "failed" status.
    const terminalCall = updateJobFn.mock.calls.find((call) => {
      const status = (call[1] as { status?: string } | undefined)?.status;
      return status === "completed" || status === "failed";
    });
    expect(terminalCall).toBeUndefined();
  });

  it("does not throw when terminal updateJobFn call fails", async () => {
    const api = makeQuietApi();
    const persister = createMobilePersister({
      systemId: TEST_SYSTEM_ID,
      source: TEST_SOURCE,
      masterKey: makeTestMasterKey(),
      api,
      avatarFetcher: NOOP_AVATAR_FETCHER,
      preloadHints: [],
    });

    const updateJobFn = vi.fn().mockImplementation((_id: unknown, patch: { status?: string }) => {
      // Throw only on the terminal call — when status is "completed" or "failed".
      if (patch.status === "completed" || patch.status === "failed") {
        return Promise.reject(new Error("network error"));
      }
      return Promise.resolve();
    });

    // Should not throw even though the terminal updateJobFn throws.
    const result = await runSpImport({
      source: createFakeImportSource(makeMinimalSourceData()),
      persister,
      importJobId: TEST_JOB_ID,
      options: {
        selectedCategories: ALL_CATEGORIES_SELECTED,
        avatarMode: AVATAR_MODE,
      },
      updateJobFn,
    });

    // The import itself must still report completed even when the terminal
    // updateJobFn persistence throws — swallow behavior is the point here.
    expect(result.outcome).toBe("completed");
  });
});
