// @vitest-environment happy-dom
import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { brandId } from "@pluralscape/types";
import { act, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { makeRawCustomFront } from "../../__tests__/factories.js";

import { renderHookWithProviders, TEST_SYSTEM_ID } from "./helpers/render-hook-with-providers.js";

import type { CustomFrontId } from "@pluralscape/types";

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
  customFront: {
    get: { invalidate: vi.fn() },
    list: { invalidate: vi.fn() },
  },
};

// ── tRPC mock backed by real React Query ─────────────────────────────
vi.mock("@pluralscape/api-client/trpc", async () => {
  const rq = await import("@tanstack/react-query");

  return {
    trpc: {
      customFront: {
        get: {
          useQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
            rq.useQuery({
              queryKey: ["customFront.get", input],
              queryFn: () => Promise.resolve(fixtures.get("customFront.get")),
              enabled: opts.enabled as boolean | undefined,
              select: opts.select as ((d: unknown) => unknown) | undefined,
            }),
        },
        list: {
          useInfiniteQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
            rq.useInfiniteQuery({
              queryKey: ["customFront.list", input],
              queryFn: () => Promise.resolve(fixtures.get("customFront.list")),
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
        update: {
          useMutation: (opts: Record<string, unknown> = {}) =>
            rq.useMutation({
              mutationFn: () => Promise.resolve({}),
              onSuccess: opts.onSuccess as
                | ((data: unknown, variables: unknown) => void)
                | undefined,
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
const {
  useCustomFront,
  useCustomFrontsList,
  useCreateCustomFront,
  useUpdateCustomFront,
  useDeleteCustomFront,
} = await import("../use-custom-fronts.js");

beforeEach(() => {
  fixtures.clear();
  vi.clearAllMocks();
});

// ── Query tests ─────────────────────────────────────────────────────
describe("useCustomFront", () => {
  it("returns decrypted custom front data", async () => {
    fixtures.set("customFront.get", makeRawCustomFront("cf-1"));
    const { result } = renderHookWithProviders(() =>
      useCustomFront(brandId<CustomFrontId>("cf-1")),
    );

    let data: Awaited<ReturnType<typeof useCustomFront>>["data"] | undefined;
    await waitFor(() => {
      data = result.current.data;
      expect(result.current.isSuccess).toBe(true);
    });
    expect(data?.name).toBe("Front cf-1");
    expect(data?.description).toBe("A test front");
    expect(data?.archived).toBe(false);
  });

  it("does not fetch when masterKey is null", () => {
    const { result } = renderHookWithProviders(
      () => useCustomFront(brandId<CustomFrontId>("cf-1")),
      {
        masterKey: null,
      },
    );
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });

  it("select is stable across rerenders (useCallback memoization)", async () => {
    fixtures.set("customFront.get", makeRawCustomFront("cf-1"));
    const { result, rerender } = renderHookWithProviders(() =>
      useCustomFront(brandId<CustomFrontId>("cf-1")),
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const ref1 = result.current.data;
    rerender();
    expect(result.current.data).toBe(ref1);
  });
});

describe("useCustomFrontsList", () => {
  it("returns decrypted paginated custom fronts", async () => {
    const raw1 = makeRawCustomFront("cf-1");
    const raw2 = makeRawCustomFront("cf-2");
    fixtures.set("customFront.list", { data: [raw1, raw2], nextCursor: null });

    const { result } = renderHookWithProviders(() => useCustomFrontsList());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const data = result.current.data;
    const pages = data && "pages" in data ? data.pages : [];
    expect(pages).toHaveLength(1);
    const items = pages[0] && "data" in pages[0] ? pages[0].data : [];
    expect(items).toHaveLength(2);
    expect(items[0]?.name).toBe("Front cf-1");
    expect(items[1]?.name).toBe("Front cf-2");
  });

  it("does not fetch when masterKey is null", () => {
    const { result } = renderHookWithProviders(() => useCustomFrontsList(), {
      masterKey: null,
    });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("select is stable across rerenders", async () => {
    fixtures.set("customFront.list", {
      data: [makeRawCustomFront("cf-1")],
      nextCursor: null,
    });
    const { result, rerender } = renderHookWithProviders(() => useCustomFrontsList());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const ref1 = result.current.data;
    rerender();
    expect(result.current.data).toBe(ref1);
  });

  it("local query excludes archived when includeArchived is false", () => {
    const queryAllMock = vi.fn().mockReturnValue([]);
    const localDb = {
      initialize: vi.fn(),
      queryOne: vi.fn(),
      queryAll: queryAllMock,
      execute: vi.fn(),
      transaction: vi.fn((fn: () => unknown) => fn()),
      close: vi.fn(),
    };
    renderHookWithProviders(() => useCustomFrontsList(), {
      querySource: "local",
      localDb: localDb as never,
    });
    expect(queryAllMock).toHaveBeenCalledWith(
      expect.stringContaining("AND archived = 0"),
      expect.any(Array),
    );
  });

  it("local query includes archived when includeArchived is true", () => {
    const queryAllMock = vi.fn().mockReturnValue([]);
    const localDb = {
      initialize: vi.fn(),
      queryOne: vi.fn(),
      queryAll: queryAllMock,
      execute: vi.fn(),
      transaction: vi.fn((fn: () => unknown) => fn()),
      close: vi.fn(),
    };
    renderHookWithProviders(() => useCustomFrontsList({ includeArchived: true }), {
      querySource: "local",
      localDb: localDb as never,
    });
    expect(queryAllMock).toHaveBeenCalledWith(
      expect.not.stringContaining("AND archived = 0"),
      expect.any(Array),
    );
  });
});

// ── Mutation tests ──────────────────────────────────────────────────
describe("useCreateCustomFront", () => {
  it("invalidates list on success", async () => {
    const { result } = renderHookWithProviders(() => useCreateCustomFront());

    await act(() => result.current.mutateAsync({} as never));

    await waitFor(() => {
      expect(mockUtils.customFront.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useUpdateCustomFront", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useUpdateCustomFront());

    await act(() => result.current.mutateAsync({ customFrontId: "cf-1" } as never));

    await waitFor(() => {
      expect(mockUtils.customFront.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        customFrontId: "cf-1",
      });
      expect(mockUtils.customFront.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useDeleteCustomFront", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useDeleteCustomFront());

    await act(() => result.current.mutateAsync({ customFrontId: "cf-2" } as never));

    await waitFor(() => {
      expect(mockUtils.customFront.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        customFrontId: "cf-2",
      });
      expect(mockUtils.customFront.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});
