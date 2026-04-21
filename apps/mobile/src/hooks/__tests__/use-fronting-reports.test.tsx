// @vitest-environment happy-dom
import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { brandId } from "@pluralscape/types";
import { act, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { makeRawFrontingReport } from "../../__tests__/factories.js";

import { renderHookWithProviders, TEST_SYSTEM_ID } from "./helpers/render-hook-with-providers.js";

import type { FrontingReportId, UnixMillis } from "@pluralscape/types";

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
});

// ── Fixture registry (accessible from vi.mock via hoisting) ──────────
const { fixtures } = vi.hoisted(() => {
  const store = new Map<string, unknown>();
  return { fixtures: store };
});

// ── Mock utils for mutation invalidation tracking ────────────────────
const mockUtils = {
  frontingReport: {
    get: { invalidate: vi.fn() },
    list: { invalidate: vi.fn() },
  },
};

// ── tRPC mock backed by real React Query ─────────────────────────────
vi.mock("@pluralscape/api-client/trpc", async () => {
  const rq = await import("@tanstack/react-query");

  return {
    trpc: {
      frontingReport: {
        get: {
          useQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
            rq.useQuery({
              queryKey: ["frontingReport.get", input],
              queryFn: () => Promise.resolve(fixtures.get("frontingReport.get")),
              enabled: opts.enabled as boolean | undefined,
              select: opts.select as ((d: unknown) => unknown) | undefined,
            }),
        },
        list: {
          useInfiniteQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
            rq.useInfiniteQuery({
              queryKey: ["frontingReport.list", input],
              queryFn: () => Promise.resolve(fixtures.get("frontingReport.list")),
              enabled: opts.enabled as boolean | undefined,
              select: opts.select as ((d: unknown) => unknown) | undefined,
              getNextPageParam: opts.getNextPageParam as (lp: unknown) => unknown,
              initialPageParam: undefined,
            }),
        },
        create: {
          useMutation: (opts: Record<string, unknown> = {}) =>
            rq.useMutation({
              mutationFn: () => Promise.resolve({}),
              onSuccess: opts.onSuccess as (() => void) | undefined,
            }),
        },
        delete: {
          useMutation: (opts: Record<string, unknown> = {}) =>
            rq.useMutation({
              mutationFn: () => Promise.resolve({}),
              onSuccess: opts.onSuccess as
                | ((data: unknown, variables: unknown) => void)
                | undefined,
            }),
        },
      },
      useUtils: () => mockUtils,
    },
  };
});

// Must import AFTER vi.mock
const { useFrontingReport, useFrontingReportsList, useGenerateReport, useDeleteReport } =
  await import("../use-fronting-reports.js");

const START = 1_699_900_000_000 as UnixMillis;
const END = 1_700_000_000_000 as UnixMillis;

beforeEach(() => {
  fixtures.clear();
  vi.clearAllMocks();
});

// ── Query tests ─────────────────────────────────────────────────────
describe("useFrontingReport", () => {
  it("returns decrypted fronting report data", async () => {
    fixtures.set("frontingReport.get", makeRawFrontingReport("fr-1"));
    const { result } = renderHookWithProviders(() =>
      useFrontingReport(brandId<FrontingReportId>("fr-1")),
    );

    let data: Awaited<ReturnType<typeof useFrontingReport>>["data"] | undefined;
    await waitFor(() => {
      data = result.current.data;
      expect(result.current.isSuccess).toBe(true);
    });
    expect(data?.id).toBe("fr-1");
    expect(data?.systemId).toBe(TEST_SYSTEM_ID);
    expect(data?.format).toBe("html");
    expect(data?.dateRange).toEqual({ start: START, end: END });
    expect(data?.memberBreakdowns).toEqual([]);
    expect(data?.chartData).toEqual([]);
  });

  it("does not fetch when masterKey is null", () => {
    const { result } = renderHookWithProviders(
      () => useFrontingReport(brandId<FrontingReportId>("fr-1")),
      { masterKey: null },
    );
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });

  it("select is stable across rerenders (useCallback memoization)", async () => {
    fixtures.set("frontingReport.get", makeRawFrontingReport("fr-1"));
    const { result, rerender } = renderHookWithProviders(() =>
      useFrontingReport(brandId<FrontingReportId>("fr-1")),
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const ref1 = result.current.data;
    rerender();
    expect(result.current.data).toBe(ref1);
  });
});

describe("useFrontingReportsList", () => {
  it("returns decrypted paginated fronting reports", async () => {
    const raw1 = makeRawFrontingReport("fr-1");
    const raw2 = makeRawFrontingReport("fr-2");
    fixtures.set("frontingReport.list", { data: [raw1, raw2], nextCursor: null });

    const { result } = renderHookWithProviders(() => useFrontingReportsList());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const data = result.current.data;
    const pages = data && "pages" in data ? data.pages : [];
    expect(pages).toHaveLength(1);
    expect(pages[0]?.data).toHaveLength(2);
    expect(pages[0]?.data[0]?.id).toBe("fr-1");
    expect(pages[0]?.data[1]?.id).toBe("fr-2");
  });

  it("does not fetch when masterKey is null", () => {
    const { result } = renderHookWithProviders(() => useFrontingReportsList(), {
      masterKey: null,
    });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("select is stable across rerenders", async () => {
    fixtures.set("frontingReport.list", {
      data: [makeRawFrontingReport("fr-1")],
      nextCursor: null,
    });
    const { result, rerender } = renderHookWithProviders(() => useFrontingReportsList());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const ref1 = result.current.data;
    rerender();
    expect(result.current.data).toBe(ref1);
  });
});

// ── Mutation tests ──────────────────────────────────────────────────
describe("useGenerateReport", () => {
  it("invalidates list on success", async () => {
    const { result } = renderHookWithProviders(() => useGenerateReport());

    await act(() => result.current.mutateAsync({} as never));

    await waitFor(() => {
      expect(mockUtils.frontingReport.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useDeleteReport", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useDeleteReport());

    await act(() => result.current.mutateAsync({ reportId: "fr-1" } as never));

    await waitFor(() => {
      expect(mockUtils.frontingReport.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        reportId: "fr-1",
      });
      expect(mockUtils.frontingReport.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});
