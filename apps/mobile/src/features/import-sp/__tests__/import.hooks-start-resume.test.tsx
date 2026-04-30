/**
 * Import hooks tests — useStartImport and useResumeActiveImport.
 *
 * Covers: startWithToken, startWithFile, abort ref, error coercion, masterKey
 *         guard, resume with/without checkpoint, resume no-op guard
 * Companion file: import.hooks-query-cancel.test.tsx
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
const { useStartImport, useResumeActiveImport } = await import("../import.hooks.js");

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

// ── useStartImport ───────────────────────────────────────────────────
describe("useStartImport", () => {
  it("startWithToken creates a job with source: simply-plural and returns the id", async () => {
    fixtures.set("importJob.create.return", {
      id: brandId<ImportJobId>("ij_new"),
      systemId: brandId<SystemId>("sys_test"),
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

    await waitFor(() => {
      expect(runSpImportMock).toHaveBeenCalled();
    });
    expect(runSpImportMock.mock.calls.length).toBe(1);
    const firstCall = runSpImportMock.mock.calls[0];
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

  it("exposes abortControllerRef as a React ref object", () => {
    const { result } = renderHookWithProviders(() => useStartImport());
    expect(result.current.abortControllerRef).toHaveProperty("current");
    expect(result.current.abortControllerRef.current).toBeNull();
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

  it("startWithToken throws when masterKey is null", async () => {
    const { result } = renderHookWithProviders(() => useStartImport(), { masterKey: null });

    await expect(
      act(async () => {
        await result.current.startWithToken({
          token: "test-token",
          options: { selectedCategories: {}, avatarMode: "skip" },
        });
      }),
    ).rejects.toThrow("useStartImport requires an unlocked crypto provider");
  });

  it("startWithFile throws when masterKey is null", async () => {
    const { result } = renderHookWithProviders(() => useStartImport(), { masterKey: null });

    await expect(
      act(async () => {
        await result.current.startWithFile({
          jsonAsset: { uri: "file:///sp.json", name: "sp.json" },
          zipAsset: null,
          options: { selectedCategories: {}, avatarMode: "skip" },
        });
      }),
    ).rejects.toThrow("useStartImport requires an unlocked crypto provider");
  });

  it("coerces non-Error rejection from startWithToken to an Error instance", async () => {
    runSpImportMock.mockRejectedValueOnce("string rejection");
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
    expect(result.current.error?.message).toBe("string rejection");
  });

  it("coerces non-Error rejection from startWithFile to an Error instance", async () => {
    runSpImportMock.mockRejectedValueOnce(42);
    const { result } = renderHookWithProviders(() => useStartImport());

    await act(async () => {
      await result.current.startWithFile({
        jsonAsset: { uri: "file:///sp.json", name: "sp.json" },
        zipAsset: null,
        options: { selectedCategories: {}, avatarMode: "skip" },
      });
    });

    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(Error);
    });
    expect(result.current.error?.message).toBe("42");
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
    expect(runSpImportMock).not.toHaveBeenCalled();
  });

  it("exposes error as null initially", () => {
    const { result } = renderHookWithProviders(() => useResumeActiveImport());
    expect(result.current.error).toBeNull();
  });

  it("exposes abortControllerRef as a React ref object", () => {
    const { result } = renderHookWithProviders(() => useResumeActiveImport());
    expect(result.current.abortControllerRef).toHaveProperty("current");
    expect(result.current.abortControllerRef.current).toBeNull();
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

  it("resume() throws when masterKey is null", async () => {
    const job = {
      ...makeJob("ij_active", "importing"),
      checkpointState: null,
    };
    fixtures.set("importJob.list", { data: [job], nextCursor: null });

    const { result } = renderHookWithProviders(() => useResumeActiveImport(), {
      masterKey: null,
    });
    await waitFor(() => {
      expect(result.current.activeJob).not.toBeNull();
    });

    await expect(
      act(async () => {
        await result.current.resume();
      }),
    ).rejects.toThrow("useResumeActiveImport requires an unlocked crypto provider");
  });

  it("coerces non-Error rejection during resume to an Error instance", async () => {
    runSpImportMock.mockRejectedValueOnce("plain string error");
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
    expect(result.current.error?.message).toBe("plain string error");
  });

  it("resume() omits initialCheckpoint when checkpointState is null", async () => {
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

    expect(runSpImportMock).toHaveBeenCalledTimes(1);
    const callArgs = runSpImportMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(callArgs).not.toHaveProperty("initialCheckpoint");
  });
});
