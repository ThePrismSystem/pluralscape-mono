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
          useQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
            rq.useQuery({
              queryKey: ["importJob.get", input],
              queryFn: () => Promise.resolve(fixtures.get("importJob.get")),
              enabled: opts.enabled as boolean | undefined,
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
const { useStartImport, useImportJob } = await import("../import.hooks.js");

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
    expect(passedArgs.importJobId).toBe("ij_test");
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
      expect(runSpImportMock).toHaveBeenCalled();
    });
  });

  it("isStarting is false before start is invoked", () => {
    const { result } = renderHookWithProviders(() => useStartImport());
    expect(result.current.isStarting).toBe(false);
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
