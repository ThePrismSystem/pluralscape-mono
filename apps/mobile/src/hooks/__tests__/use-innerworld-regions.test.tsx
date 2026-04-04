// @vitest-environment happy-dom
import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { encryptInnerWorldRegionInput } from "@pluralscape/data/transforms/innerworld-region";
import { act, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  renderHookWithProviders,
  TEST_MASTER_KEY,
  TEST_SYSTEM_ID,
} from "./helpers/render-hook-with-providers.js";

import type { InnerWorldRegionRaw } from "@pluralscape/data/transforms/innerworld-region";
import type { InnerWorldRegionId, UnixMillis, VisualProperties } from "@pluralscape/types";

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
  innerworld: {
    region: {
      get: { invalidate: vi.fn() },
      list: { invalidate: vi.fn() },
    },
  },
};

// ── tRPC mock backed by real React Query ─────────────────────────────
vi.mock("@pluralscape/api-client/trpc", async () => {
  const rq = await import("@tanstack/react-query");

  return {
    trpc: {
      innerworld: {
        region: {
          get: {
            useQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
              rq.useQuery({
                queryKey: ["innerworld.region.get", input],
                queryFn: () => Promise.resolve(fixtures.get("innerworld.region.get")),
                enabled: opts.enabled as boolean | undefined,
                select: opts.select as ((d: unknown) => unknown) | undefined,
              }),
          },
          list: {
            useInfiniteQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
              rq.useInfiniteQuery({
                queryKey: ["innerworld.region.list", input],
                queryFn: () => Promise.resolve(fixtures.get("innerworld.region.list")),
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
          archive: {
            useMutation: (opts: Record<string, unknown> = {}) =>
              rq.useMutation({
                mutationFn: () => Promise.resolve({}),
                onSuccess: opts.onSuccess as
                  | ((data: unknown, variables: unknown) => void)
                  | undefined,
              }),
          },
          restore: {
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
      },
      useUtils: () => mockUtils,
    },
  };
});

// Must import AFTER vi.mock
const {
  useInnerWorldRegion,
  useInnerWorldRegionsList,
  useCreateInnerWorldRegion,
  useUpdateInnerWorldRegion,
  useArchiveInnerWorldRegion,
  useRestoreInnerWorldRegion,
  useDeleteInnerWorldRegion,
} = await import("../use-innerworld-regions.js");

// ── Fixtures ─────────────────────────────────────────────────────────
const NOW = 1_700_000_000_000 as UnixMillis;

const DEFAULT_VISUAL: VisualProperties = {
  color: null,
  icon: null,
  size: null,
  opacity: null,
  imageSource: null,
  externalUrl: null,
};

function makeRawRegion(id: string): InnerWorldRegionRaw {
  const encrypted = encryptInnerWorldRegionInput(
    {
      name: `Region ${id}`,
      description: "A test region",
      boundaryData: [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ],
      visual: DEFAULT_VISUAL,
      gatekeeperMemberIds: [],
      accessType: "open",
    },
    TEST_MASTER_KEY,
  );
  return {
    id: id as InnerWorldRegionId,
    systemId: TEST_SYSTEM_ID,
    parentRegionId: null,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    archived: false,
    archivedAt: null,
    ...encrypted,
  };
}

beforeEach(() => {
  fixtures.clear();
  vi.clearAllMocks();
});

// ── Query tests ─────────────────────────────────────────────────────
describe("useInnerWorldRegion", () => {
  it("returns decrypted region data", async () => {
    fixtures.set("innerworld.region.get", makeRawRegion("r-1"));
    const { result } = renderHookWithProviders(() =>
      useInnerWorldRegion("r-1" as InnerWorldRegionId),
    );

    let data: Awaited<ReturnType<typeof useInnerWorldRegion>>["data"] | undefined;
    await waitFor(() => {
      data = result.current.data;
      expect(data).toBeDefined();
    });
    expect(data?.name).toBe("Region r-1");
    expect(data?.description).toBe("A test region");
    expect(data?.accessType).toBe("open");
    expect(data?.boundaryData).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ]);
    expect(data?.archived).toBe(false);
  });

  it("does not fetch when masterKey is null", () => {
    const { result } = renderHookWithProviders(
      () => useInnerWorldRegion("r-1" as InnerWorldRegionId),
      { masterKey: null },
    );
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });

  it("select is stable across rerenders (useCallback memoization)", async () => {
    fixtures.set("innerworld.region.get", makeRawRegion("r-1"));
    const { result, rerender } = renderHookWithProviders(() =>
      useInnerWorldRegion("r-1" as InnerWorldRegionId),
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const ref1 = result.current.data;
    rerender();
    expect(result.current.data).toBe(ref1);
  });
});

describe("useInnerWorldRegionsList", () => {
  it("returns decrypted paginated regions", async () => {
    const raw1 = makeRawRegion("r-1");
    const raw2 = makeRawRegion("r-2");
    fixtures.set("innerworld.region.list", { data: [raw1, raw2], nextCursor: null });

    const { result } = renderHookWithProviders(() => useInnerWorldRegionsList());

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const pages = result.current.data?.pages ?? [];
    const [firstPage] = pages;
    const [item0, item1] = firstPage?.data ?? [];
    expect(pages).toHaveLength(1);
    expect(firstPage?.data).toHaveLength(2);
    expect(item0?.name).toBe("Region r-1");
    expect(item1?.name).toBe("Region r-2");
  });

  it("does not fetch when masterKey is null", () => {
    const { result } = renderHookWithProviders(() => useInnerWorldRegionsList(), {
      masterKey: null,
    });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("select is stable across rerenders", async () => {
    fixtures.set("innerworld.region.list", {
      data: [makeRawRegion("r-1")],
      nextCursor: null,
    });
    const { result, rerender } = renderHookWithProviders(() => useInnerWorldRegionsList());

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const ref1 = result.current.data;
    rerender();
    expect(result.current.data).toBe(ref1);
  });
});

// ── Mutation tests ──────────────────────────────────────────────────
describe("useCreateInnerWorldRegion", () => {
  it("invalidates list on success", async () => {
    const { result } = renderHookWithProviders(() => useCreateInnerWorldRegion());

    await act(() => result.current.mutateAsync({} as never));

    await waitFor(() => {
      expect(mockUtils.innerworld.region.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useUpdateInnerWorldRegion", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useUpdateInnerWorldRegion());

    await act(() => result.current.mutateAsync({ regionId: "r-1" } as never));

    await waitFor(() => {
      expect(mockUtils.innerworld.region.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        regionId: "r-1",
      });
      expect(mockUtils.innerworld.region.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useArchiveInnerWorldRegion", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useArchiveInnerWorldRegion());

    await act(() => result.current.mutateAsync({ regionId: "r-2" } as never));

    await waitFor(() => {
      expect(mockUtils.innerworld.region.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        regionId: "r-2",
      });
      expect(mockUtils.innerworld.region.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useRestoreInnerWorldRegion", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useRestoreInnerWorldRegion());

    await act(() => result.current.mutateAsync({ regionId: "r-3" } as never));

    await waitFor(() => {
      expect(mockUtils.innerworld.region.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        regionId: "r-3",
      });
      expect(mockUtils.innerworld.region.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useDeleteInnerWorldRegion", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useDeleteInnerWorldRegion());

    await act(() => result.current.mutateAsync({ regionId: "r-4" } as never));

    await waitFor(() => {
      expect(mockUtils.innerworld.region.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        regionId: "r-4",
      });
      expect(mockUtils.innerworld.region.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});
