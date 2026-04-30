/**
 * Import hooks tests — useImportJob, useImportProgress, useImportSummary,
 * and useCancelImport.
 *
 * Covers: disabled query for null id, poll interval wiring, progress snapshot
 *         derivation, summary derivation, cancel with checkpoint preservation
 * Companion file: import.hooks-start-resume.test.tsx
 */
// @vitest-environment happy-dom
import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { brandId } from "@pluralscape/types";
import { act, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { renderHookWithProviders } from "../../../hooks/__tests__/helpers/render-hook-with-providers.js";

import type { ImportJob, ImportJobId, SystemId, UnixMillis } from "@pluralscape/types";

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
});

// ── Fixture registry ─────────────────────────────────────────────────
const { fixtures } = vi.hoisted(() => {
  const store = new Map<string, unknown>();
  return { fixtures: store };
});

// ── runSpImport mock ─────────────────────────────────────────────────
const { runSpImportMock } = vi.hoisted(() => {
  return { runSpImportMock: vi.fn() };
});

vi.mock("../import-runner.js", async () => {
  const actual = await vi.importActual<typeof import("../import-runner.js")>("../import-runner.js");
  return {
    ...actual,
    runSpImport: runSpImportMock,
  };
});

// ── tRPC mock ────────────────────────────────────────────────────────
vi.mock("@pluralscape/api-client/trpc", async () => {
  const rq = await import("@tanstack/react-query");
  return {
    trpc: {
      importJob: {
        create: {
          useMutation: (opts: Record<string, unknown> = {}) =>
            rq.useMutation({
              mutationFn: (input: unknown) => {
                fixtures.set("importJob.create.lastInput", input);
                const stubbed = fixtures.get("importJob.create.return");
                return Promise.resolve(
                  stubbed ?? {
                    id: brandId<ImportJobId>("ij_test"),
                    systemId: brandId<SystemId>("sys_test"),
                  },
                );
              },
              onSuccess: opts.onSuccess as (() => void) | undefined,
            }),
        },
        update: {
          useMutation: (opts: Record<string, unknown> = {}) =>
            rq.useMutation({
              mutationFn: (input: unknown) => {
                fixtures.set("importJob.update.lastInput", input);
                return Promise.resolve({});
              },
              onSuccess: opts.onSuccess as (() => void) | undefined,
            }),
        },
        get: {
          useQuery: (input: unknown, opts: Record<string, unknown> = {}) => {
            const queryOpts: Parameters<typeof rq.useQuery>[0] = {
              queryKey: ["importJob.get", input],
              queryFn: () => Promise.resolve(fixtures.get("importJob.get")),
              enabled: opts.enabled as boolean | undefined,
            };
            if (opts.refetchInterval !== undefined) {
              fixtures.set("importJob.get.lastRefetchInterval", opts.refetchInterval);
              queryOpts.refetchInterval = opts.refetchInterval as never;
            }
            return rq.useQuery(queryOpts);
          },
        },
        list: {
          useQuery: (input: unknown) =>
            rq.useQuery({
              queryKey: ["importJob.list", input],
              queryFn: () =>
                Promise.resolve(fixtures.get("importJob.list") ?? { data: [], nextCursor: null }),
            }),
        },
      },
      useUtils: () => ({ client: { system: {} } }),
    },
  };
});

// ── expo-secure-store mock ───────────────────────────────────────────
vi.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    WHEN_UNLOCKED: "AccessibleWhenUnlocked" as const,
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: "AccessibleWhenUnlockedThisDeviceOnly" as const,
    AFTER_FIRST_UNLOCK: "AccessibleAfterFirstUnlock" as const,
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: "AccessibleAfterFirstUnlockThisDeviceOnly" as const,
    getItemAsync: (key: string) => Promise.resolve(store.get(key) ?? null),
    setItemAsync: (key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    },
    deleteItemAsync: (key: string) => {
      store.delete(key);
      return Promise.resolve();
    },
  };
});

// Must import AFTER all mocks
const { useImportJob, useImportProgress, useImportSummary, useCancelImport } = await import(
  "../import.hooks.js"
);
const { IMPORT_PROGRESS_POLL_INTERVAL_MS } = await import("../import-sp-mobile.constants.js");

// ── Fixtures ─────────────────────────────────────────────────────────
const NOW = 1_700_000_000_000 as UnixMillis;

function makeJob(id: string, status: ImportJob["status"]): ImportJob {
  return {
    id: brandId<ImportJobId>(id),
    accountId: "acc_test" as ImportJob["accountId"],
    systemId: brandId<SystemId>("sys_test"),
    source: "simply-plural",
    status,
    progressPercent: status === "completed" ? 100 : 0,
    errorLog: null,
    warningCount: 0,
    chunksTotal: null,
    chunksCompleted: 0,
    createdAt: NOW,
    updatedAt: NOW,
    completedAt: status === "completed" ? NOW : null,
  };
}

beforeEach(() => {
  fixtures.clear();
  runSpImportMock.mockReset();
  runSpImportMock.mockResolvedValue({
    finalState: {
      schemaVersion: 1,
      checkpoint: {
        completedCollections: [],
        currentCollection: "system-profile",
        currentCollectionLastSourceId: null,
      },
      options: { selectedCategories: {}, avatarMode: "skip" },
      totals: { perCollection: {} },
    },
    warnings: [],
    errors: [],
    outcome: "completed",
  });
});

// ── useImportJob ─────────────────────────────────────────────────────
describe("useImportJob", () => {
  it("returns the job row for a non-null id", async () => {
    const job = makeJob("ij_1", "importing");
    fixtures.set("importJob.get", job);

    const { result } = renderHookWithProviders(() => useImportJob(brandId<ImportJobId>("ij_1")));

    await waitFor(() => {
      expect(result.current.data).toEqual(job);
    });
  });

  it("returns a disabled query for a null id", () => {
    const { result } = renderHookWithProviders(() => useImportJob(null));
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });
});

// ── useImportProgress ────────────────────────────────────────────────
describe("useImportProgress", () => {
  it("returns null for a null jobId", () => {
    const { result } = renderHookWithProviders(() => useImportProgress(null));
    expect(result.current).toBeNull();
  });

  it("wires refetchInterval with the poll constant for non-terminal jobs", async () => {
    const job = makeJob("ij_poll", "importing");
    fixtures.set("importJob.get", job);

    renderHookWithProviders(() => useImportProgress(brandId<ImportJobId>("ij_poll")));

    await waitFor(() => {
      expect(typeof fixtures.get("importJob.get.lastRefetchInterval")).toBe("function");
    });

    const refetchIntervalFn = fixtures.get("importJob.get.lastRefetchInterval") as (q: {
      state: { data: ImportJob | undefined };
    }) => number | false;
    expect(refetchIntervalFn({ state: { data: makeJob("ij_poll", "importing") } })).toBe(
      IMPORT_PROGRESS_POLL_INTERVAL_MS,
    );
    expect(refetchIntervalFn({ state: { data: makeJob("ij_poll", "completed") } })).toBe(false);
    expect(refetchIntervalFn({ state: { data: makeJob("ij_poll", "failed") } })).toBe(false);
    expect(refetchIntervalFn({ state: { data: undefined } })).toBe(
      IMPORT_PROGRESS_POLL_INTERVAL_MS,
    );
  });

  it("derives the snapshot fields from the job row", async () => {
    const job = makeJob("ij_snap", "importing");
    fixtures.set("importJob.get", {
      ...job,
      progressPercent: 42,
      errorLog: [
        {
          entityType: "member",
          entityId: "mid_1",
          message: "test",
          fatal: false,
          recoverable: false,
        },
      ],
      checkpointState: {
        schemaVersion: 1,
        checkpoint: {
          completedCollections: [],
          currentCollection: "member",
          currentCollectionLastSourceId: null,
        },
        options: { selectedCategories: {}, avatarMode: "skip" },
        totals: {
          perCollection: {
            member: { total: 10, imported: 4, updated: 2, skipped: 1, failed: 0 },
          },
        },
      },
    });

    const { result } = renderHookWithProviders(() =>
      useImportProgress(brandId<ImportJobId>("ij_snap")),
    );

    await waitFor(() => {
      expect(result.current).not.toBeNull();
    });
    expect(result.current).toEqual({
      progressPercent: 42,
      currentCollection: "member",
      processedItems: 7, // 4 + 2 + 1
      totalItems: 10,
      errorCount: 1,
      status: "importing",
    });
  });

  it("derives zero totals when checkpointState is null", async () => {
    const job = makeJob("ij_null_cp", "importing");
    fixtures.set("importJob.get", {
      ...job,
      checkpointState: null,
      errorLog: null,
    });

    const { result } = renderHookWithProviders(() =>
      useImportProgress(brandId<ImportJobId>("ij_null_cp")),
    );

    await waitFor(() => {
      expect(result.current).not.toBeNull();
    });
    expect(result.current).toEqual({
      progressPercent: 0,
      currentCollection: null,
      processedItems: 0,
      totalItems: 0,
      errorCount: 0,
      status: "importing",
    });
  });
});

// ── useImportSummary ─────────────────────────────────────────────────
describe("useImportSummary", () => {
  it("returns null for a null jobId", () => {
    const { result } = renderHookWithProviders(() => useImportSummary(null));
    expect(result.current).toBeNull();
  });

  it("derives the summary for a completed job", async () => {
    const job = makeJob("ij_sum", "completed");
    fixtures.set("importJob.get", {
      ...job,
      errorLog: [
        {
          entityType: "member",
          entityId: "mid_1",
          message: "non-fatal",
          fatal: false,
          recoverable: false,
        },
      ],
      checkpointState: {
        schemaVersion: 1,
        checkpoint: {
          completedCollections: [],
          currentCollection: "member",
          currentCollectionLastSourceId: null,
        },
        options: { selectedCategories: {}, avatarMode: "skip" },
        totals: {
          perCollection: {
            member: { total: 10, imported: 10, updated: 0, skipped: 0, failed: 0 },
          },
        },
      },
    });

    const { result } = renderHookWithProviders(() =>
      useImportSummary(brandId<ImportJobId>("ij_sum")),
    );

    await waitFor(() => {
      expect(result.current).not.toBeNull();
    });
    const snapshot = result.current;
    expect(snapshot?.status).toBe("completed");
    expect(snapshot?.completedAt).toBe(NOW);
    expect(snapshot?.errors).toHaveLength(1);
    expect(snapshot?.perCollection.member).toEqual({
      total: 10,
      imported: 10,
      updated: 0,
      skipped: 0,
      failed: 0,
    });
  });

  it("returns empty perCollection and errors when checkpointState is null", async () => {
    const job = makeJob("ij_sum_null", "failed");
    fixtures.set("importJob.get", {
      ...job,
      checkpointState: null,
      errorLog: null,
    });

    const { result } = renderHookWithProviders(() =>
      useImportSummary(brandId<ImportJobId>("ij_sum_null")),
    );

    await waitFor(() => {
      expect(result.current).not.toBeNull();
    });
    expect(result.current?.perCollection).toEqual({});
    expect(result.current?.errors).toEqual([]);
    expect(result.current?.status).toBe("failed");
    expect(result.current?.completedAt).toBeNull();
  });
});

// ── useCancelImport ──────────────────────────────────────────────────
describe("useCancelImport", () => {
  it("calls importJob.update with status=failed and preserves checkpoint", async () => {
    const job = {
      ...makeJob("ij_cancel", "importing"),
      checkpointState: {
        schemaVersion: 1,
        checkpoint: {
          completedCollections: ["privacy-bucket"],
          currentCollection: "member",
          currentCollectionLastSourceId: "src_1",
        },
        options: { selectedCategories: {}, avatarMode: "skip" },
        totals: { perCollection: {} },
      },
    };
    fixtures.set("importJob.get", job);

    const { result } = renderHookWithProviders(() => {
      const importJob = useImportJob(brandId<ImportJobId>("ij_cancel"));
      const cancel = useCancelImport(brandId<ImportJobId>("ij_cancel"));
      return { job: importJob, cancel };
    });

    await waitFor(() => {
      expect(result.current.job.isSuccess).toBe(true);
    });

    await act(async () => {
      await result.current.cancel.cancel();
    });

    const patch = fixtures.get("importJob.update.lastInput") as {
      importJobId: string;
      status: string;
      checkpointState?: { checkpoint: { currentCollection: string } };
    };
    expect(patch.importJobId).toBe("ij_cancel");
    expect(patch.status).toBe("failed");
    expect(patch.checkpointState?.checkpoint.currentCollection).toBe("member");
  });
});
