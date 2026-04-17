// @vitest-environment happy-dom
import { brandId } from "@pluralscape/types";
import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderHookWithProviders, TEST_SYSTEM_ID } from "./helpers/render-hook-with-providers.js";

import type { SystemId } from "@pluralscape/types";

// ── Fixture registry (accessible from vi.mock via hoisting) ──────────
const { fixtures } = vi.hoisted(() => {
  const store = new Map<string, unknown>();
  return { fixtures: store };
});

// ── Mock utils for mutation invalidation tracking ────────────────────
const mockUtils = {
  systemSettings: {
    settings: {
      get: { invalidate: vi.fn() },
    },
    setup: {
      getStatus: { invalidate: vi.fn() },
    },
  },
};

// ── tRPC mock backed by real React Query ─────────────────────────────
vi.mock("@pluralscape/api-client/trpc", async () => {
  const rq = await import("@tanstack/react-query");

  return {
    trpc: {
      systemSettings: {
        setup: {
          getStatus: {
            useQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
              rq.useQuery({
                queryKey: ["systemSettings.setup.getStatus", input],
                queryFn: () => Promise.resolve(fixtures.get("setup.getStatus")),
                enabled: opts.enabled as boolean | undefined,
                select: opts.select as ((d: unknown) => unknown) | undefined,
              }),
          },
          nomenclatureStep: {
            useMutation: (opts: Record<string, unknown> = {}) =>
              rq.useMutation({
                mutationFn: () => Promise.resolve({}),
                onSuccess: opts.onSuccess as
                  | ((data: unknown, variables: unknown) => void)
                  | undefined,
              }),
          },
          profileStep: {
            useMutation: (opts: Record<string, unknown> = {}) =>
              rq.useMutation({
                mutationFn: () => Promise.resolve({}),
                onSuccess: opts.onSuccess as
                  | ((data: unknown, variables: unknown) => void)
                  | undefined,
              }),
          },
          complete: {
            useMutation: (opts: Record<string, unknown> = {}) =>
              rq.useMutation({
                mutationFn: () => Promise.resolve({}),
                onSuccess: opts.onSuccess as
                  | ((data: unknown, variables: unknown) => void)
                  | undefined,
              }),
          },
        },
      },
      useUtils: () => mockUtils,
    },
  };
});

// Must import AFTER vi.mock
const { useSetupStatus, useSetupNomenclatureStep, useSetupProfileStep, useSetupComplete } =
  await import("../use-setup.js");

beforeEach(() => {
  fixtures.clear();
  vi.clearAllMocks();
});

// ── Setup status query tests ─────────────────────────────────────────
describe("useSetupStatus", () => {
  it("returns setup status data", async () => {
    const statusData = {
      isComplete: false,
      nomenclatureComplete: true,
      profileComplete: false,
    };
    fixtures.set("setup.getStatus", statusData);
    const { result } = renderHookWithProviders(() => useSetupStatus(TEST_SYSTEM_ID));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data).toEqual(statusData);
  });
});

// ── Setup mutation tests ─────────────────────────────────────────────
describe("useSetupNomenclatureStep", () => {
  it("invalidates settings and status on success", async () => {
    const { result } = renderHookWithProviders(() => useSetupNomenclatureStep());

    await act(() => result.current.mutateAsync({} as never));

    await waitFor(() => {
      expect(mockUtils.systemSettings.settings.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
      expect(mockUtils.systemSettings.setup.getStatus.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useSetupProfileStep", () => {
  it("invalidates settings and status on success", async () => {
    const { result } = renderHookWithProviders(() => useSetupProfileStep());

    await act(() => result.current.mutateAsync({} as never));

    await waitFor(() => {
      expect(mockUtils.systemSettings.settings.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
      expect(mockUtils.systemSettings.setup.getStatus.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useSetupComplete", () => {
  it("invalidates settings and status on success", async () => {
    const { result } = renderHookWithProviders(() => useSetupComplete());

    await act(() => result.current.mutateAsync({} as never));

    await waitFor(() => {
      expect(mockUtils.systemSettings.settings.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
      expect(mockUtils.systemSettings.setup.getStatus.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useSetupStatus (disabled)", () => {
  it("does not fetch when systemId is empty", () => {
    fixtures.set("setup.getStatus", { isComplete: false });
    const { result } = renderHookWithProviders(() => useSetupStatus(brandId<SystemId>("")));

    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });
});
