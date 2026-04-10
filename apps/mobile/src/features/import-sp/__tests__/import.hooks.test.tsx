// @vitest-environment happy-dom
import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { act, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { renderHookWithProviders } from "../../../hooks/__tests__/helpers/render-hook-with-providers.js";

import type { ImportJob, ImportJobId, SystemId, UnixMillis } from "@pluralscape/types";

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
});

// ── Fixture registry (accessible from vi.mock via hoisting) ──────────
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
                    id: "ij_test" as ImportJobId,
                    systemId: "sys_test" as SystemId,
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
              // Record the refetchInterval so tests can assert it was wired.
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
      useUtils: () => ({}),
    },
  };
});

// ── expo-secure-store mock (SP token storage) ────────────────────────
vi.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
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
const {
  useStartImport,
  useImportJob,
  useImportProgress,
  useImportSummary,
  useResumeActiveImport,
  useCancelImport,
} = await import("../import.hooks.js");
const { IMPORT_PROGRESS_POLL_INTERVAL_MS } = await import("../import-sp-mobile.constants.js");

// ── Fixtures ─────────────────────────────────────────────────────────
const NOW = 1_700_000_000_000 as UnixMillis;

function makeJob(id: string, status: ImportJob["status"]): ImportJob {
  return {
    id: id as ImportJobId,
    accountId: "acc_test" as ImportJob["accountId"],
    systemId: "sys_test" as SystemId,
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

// ── useStartImport ───────────────────────────────────────────────────
describe("useStartImport", () => {
  it("startWithToken creates a job with source: simply-plural and returns the id", async () => {
    fixtures.set("importJob.create.return", {
      id: "ij_new" as ImportJobId,
      systemId: "sys_test" as SystemId,
    });

    const { result } = renderHookWithProviders(() => useStartImport());

    let jobId: ImportJobId | undefined;
    await act(async () => {
      jobId = await result.current.startWithToken({
        token: "test-token",
        options: { selectedCategories: {}, avatarMode: "skip" },
      });
    });

    expect(jobId).toBe("ij_new");
    const createInput = fixtures.get("importJob.create.lastInput") as {
      source: string;
      selectedCategories: Record<string, boolean>;
      avatarMode: string;
    };
    expect(createInput.source).toBe("simply-plural");
    expect(createInput.avatarMode).toBe("skip");
  });

  it("startWithToken kicks runSpImport off after creating the job", async () => {
    const { result } = renderHookWithProviders(() => useStartImport());

    await act(async () => {
      await result.current.startWithToken({
        token: "test-token",
        options: { selectedCategories: {}, avatarMode: "skip" },
      });
    });

    // runSpImport was invoked exactly once with the job id and persister.
    await waitFor(() => {
      expect(runSpImportMock).toHaveBeenCalled();
    });
    const firstCall = runSpImportMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    const passedArgs = firstCall?.[0] as { importJobId: ImportJobId };
    expect(passedArgs).toEqual(expect.objectContaining({ importJobId: "ij_test" }));
  });

  it("startWithFile kicks runSpImport off after creating the job", async () => {
    const { result } = renderHookWithProviders(() => useStartImport());

    await act(async () => {
      await result.current.startWithFile({
        jsonAsset: { uri: "file:///sp.json", name: "sp.json" },
        zipAsset: null,
        options: { selectedCategories: {}, avatarMode: "skip" },
      });
    });

    await waitFor(() => {
      expect(runSpImportMock).toHaveBeenCalledWith(
        expect.objectContaining({ importJobId: "ij_test" }),
      );
    });
  });

  it("isStarting is false before start is invoked", () => {
    const { result } = renderHookWithProviders(() => useStartImport());
    expect(result.current.isStarting).toBe(false);
  });

  it("exposes error as null initially", () => {
    const { result } = renderHookWithProviders(() => useStartImport());
    expect(result.current.error).toBeNull();
  });

  it("exposes abortControllerRef", () => {
    const { result } = renderHookWithProviders(() => useStartImport());
    expect(result.current.abortControllerRef).toBeDefined();
  });

  it("sets error state when runSpImport rejects", async () => {
    runSpImportMock.mockRejectedValueOnce(new Error("network failure"));
    const { result } = renderHookWithProviders(() => useStartImport());

    await act(async () => {
      await result.current.startWithToken({
        token: "test-token",
        options: { selectedCategories: {}, avatarMode: "skip" },
      });
    });

    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(Error);
    });
    expect(result.current.error?.message).toBe("network failure");
  });

  it("populates abortControllerRef after start", async () => {
    const { result } = renderHookWithProviders(() => useStartImport());

    await act(async () => {
      await result.current.startWithToken({
        token: "test-token",
        options: { selectedCategories: {}, avatarMode: "skip" },
      });
    });

    expect(result.current.abortControllerRef.current).toBeInstanceOf(AbortController);
  });
});

// ── useImportJob ─────────────────────────────────────────────────────
describe("useImportJob", () => {
  it("returns the job row for a non-null id", async () => {
    const job = makeJob("ij_1", "importing");
    fixtures.set("importJob.get", job);

    const { result } = renderHookWithProviders(() => useImportJob("ij_1" as ImportJobId));

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

    renderHookWithProviders(() => useImportProgress("ij_poll" as ImportJobId));

    await waitFor(() => {
      expect(fixtures.get("importJob.get.lastRefetchInterval")).toBeDefined();
    });

    // Exercise the function form with a synthetic query-like shape and
    // assert it returns the poll interval for non-terminal, and false for
    // terminal.
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

    const { result } = renderHookWithProviders(() => useImportProgress("ij_snap" as ImportJobId));

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

    const { result } = renderHookWithProviders(() => useImportSummary("ij_sum" as ImportJobId));

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
});

// ── useResumeActiveImport ────────────────────────────────────────────
describe("useResumeActiveImport", () => {
  it("exposes the first importing job as the active job", async () => {
    const job = makeJob("ij_active", "importing");
    fixtures.set("importJob.list", { data: [job], nextCursor: null });

    const { result } = renderHookWithProviders(() => useResumeActiveImport());

    await waitFor(() => {
      expect(result.current.activeJob).not.toBeNull();
    });
    expect(result.current.activeJob?.id).toBe("ij_active");
  });

  it("resume() kicks runSpImport off with the preserved checkpoint", async () => {
    const job = {
      ...makeJob("ij_active", "importing"),
      checkpointState: {
        schemaVersion: 1,
        checkpoint: {
          completedCollections: ["privacy-bucket"],
          currentCollection: "member",
          currentCollectionLastSourceId: null,
        },
        options: { selectedCategories: {}, avatarMode: "skip" },
        totals: { perCollection: {} },
      },
    };
    fixtures.set("importJob.list", { data: [job], nextCursor: null });

    const { result } = renderHookWithProviders(() => useResumeActiveImport());

    await waitFor(() => {
      expect(result.current.activeJob).not.toBeNull();
    });

    await act(async () => {
      await result.current.resume();
    });

    expect(runSpImportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        importJobId: "ij_active",
        initialCheckpoint: expect.objectContaining({
          checkpoint: expect.objectContaining({ currentCollection: "member" }),
        }),
      }),
    );
  });

  it("resume() is a no-op when there is no active job", async () => {
    fixtures.set("importJob.list", { data: [], nextCursor: null });

    const { result } = renderHookWithProviders(() => useResumeActiveImport());
    await waitFor(() => {
      expect(result.current.activeJob).toBeNull();
    });

    await act(async () => {
      await result.current.resume();
    });
    // No runSpImport call should have been recorded since the last reset.
    expect(runSpImportMock).not.toHaveBeenCalled();
  });

  it("exposes error as null initially", () => {
    const { result } = renderHookWithProviders(() => useResumeActiveImport());
    expect(result.current.error).toBeNull();
  });

  it("exposes abortControllerRef", () => {
    const { result } = renderHookWithProviders(() => useResumeActiveImport());
    expect(result.current.abortControllerRef).toBeDefined();
  });

  it("sets error state when runSpImport rejects during resume", async () => {
    runSpImportMock.mockRejectedValueOnce(new Error("resume failure"));
    const job = {
      ...makeJob("ij_active", "importing"),
      checkpointState: null,
    };
    fixtures.set("importJob.list", { data: [job], nextCursor: null });

    const { result } = renderHookWithProviders(() => useResumeActiveImport());
    await waitFor(() => {
      expect(result.current.activeJob).not.toBeNull();
    });

    await act(async () => {
      await result.current.resume();
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe("resume failure");
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

    // Render both useCancelImport and useImportJob so we can wait for
    // the job get query to populate cache before triggering cancel.
    const { result } = renderHookWithProviders(() => {
      const job = useImportJob("ij_cancel" as ImportJobId);
      const cancel = useCancelImport("ij_cancel" as ImportJobId);
      return { job, cancel };
    });

    await waitFor(() => {
      expect(result.current.job.data).toBeDefined();
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
