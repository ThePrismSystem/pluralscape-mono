// @vitest-environment happy-dom
import { brandId } from "@pluralscape/types";
import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderHookWithProviders, TEST_SYSTEM_ID } from "./helpers/render-hook-with-providers.js";

import type { SystemId, UnixMillis } from "@pluralscape/types";

// ── Fixture registry (accessible from vi.mock via hoisting) ──────────
const { fixtures } = vi.hoisted(() => {
  const store = new Map<string, unknown>();
  return { fixtures: store };
});

// ── Mock utils for mutation invalidation tracking ────────────────────
const mockInvalidateAll = vi.fn();
const mockUtils = {
  system: {
    get: { invalidate: vi.fn() },
    list: { invalidate: vi.fn() },
  },
  invalidate: mockInvalidateAll,
};

// ── tRPC mock backed by real React Query ─────────────────────────────
vi.mock("@pluralscape/api-client/trpc", async () => {
  const rq = await import("@tanstack/react-query");

  return {
    trpc: {
      system: {
        get: {
          useQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
            rq.useQuery({
              queryKey: ["system.get", input],
              queryFn: () => Promise.resolve(fixtures.get("system.get")),
              enabled: opts.enabled as boolean | undefined,
              select: opts.select as ((d: unknown) => unknown) | undefined,
            }),
        },
        list: {
          useInfiniteQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
            rq.useInfiniteQuery({
              queryKey: ["system.list", input],
              queryFn: () => Promise.resolve(fixtures.get("system.list")),
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
        duplicate: {
          useMutation: (opts: Record<string, unknown> = {}) =>
            rq.useMutation({
              mutationFn: () => Promise.resolve({}),
              onSuccess: opts.onSuccess as
                | ((data: unknown, variables: unknown) => void)
                | undefined,
            }),
        },
        purge: {
          useMutation: (opts: Record<string, unknown> = {}) =>
            rq.useMutation({
              mutationFn: () => Promise.resolve({}),
              onSuccess: opts.onSuccess as (() => void) | undefined,
            }),
        },
      },
      useUtils: () => mockUtils,
    },
  };
});

// Must import AFTER vi.mock
const {
  useSystem,
  useSystemsList,
  useCreateSystem,
  useUpdateSystem,
  useArchiveSystem,
  useDuplicateSystem,
  usePurgeSystem,
} = await import("../use-system.js");

// ── Fixtures ─────────────────────────────────────────────────────────
const NOW = 1_700_000_000_000 as UnixMillis;

function makeSystem(id: string) {
  return {
    id: brandId<SystemId>(id),
    encryptedData: "base64_encrypted_system_data",
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

beforeEach(() => {
  fixtures.clear();
  vi.clearAllMocks();
});

// ── System query tests ───────────────────────────────────────────────
describe("useSystem", () => {
  it("returns system profile data", async () => {
    fixtures.set("system.get", makeSystem("sys_1"));
    const { result } = renderHookWithProviders(() => useSystem());

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data?.id).toBe("sys_1");
    expect(result.current.data?.version).toBe(1);
  });
});

describe("useSystemsList", () => {
  it("returns paginated systems", async () => {
    const s1 = makeSystem("sys_1");
    const s2 = makeSystem("sys_2");
    fixtures.set("system.list", { data: [s1, s2], nextCursor: null });

    const { result } = renderHookWithProviders(() => useSystemsList());

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const data = result.current.data;
    const pages = data && "pages" in data ? data.pages : [];
    const [firstPage] = pages;
    const items = firstPage && "data" in firstPage ? firstPage.data : [];
    expect(pages).toHaveLength(1);
    expect(items).toHaveLength(2);
    expect(items[0]?.id).toBe("sys_1");
    expect(items[1]?.id).toBe("sys_2");
  });
});

// ── System mutation tests ────────────────────────────────────────────
describe("useCreateSystem", () => {
  it("invalidates list on success", async () => {
    const { result } = renderHookWithProviders(() => useCreateSystem());

    await act(() => result.current.mutateAsync({} as never));

    await waitFor(() => {
      expect(mockUtils.system.list.invalidate).toHaveBeenCalled();
    });
  });
});

describe("useUpdateSystem", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useUpdateSystem());

    await act(() => result.current.mutateAsync({} as never));

    await waitFor(() => {
      expect(mockUtils.system.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
      expect(mockUtils.system.list.invalidate).toHaveBeenCalled();
    });
  });
});

describe("useArchiveSystem", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useArchiveSystem());

    await act(() => result.current.mutateAsync({} as never));

    await waitFor(() => {
      expect(mockUtils.system.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
      expect(mockUtils.system.list.invalidate).toHaveBeenCalled();
    });
  });
});

describe("useDuplicateSystem", () => {
  it("invalidates list on success", async () => {
    const { result } = renderHookWithProviders(() => useDuplicateSystem());

    await act(() => result.current.mutateAsync({} as never));

    await waitFor(() => {
      expect(mockUtils.system.list.invalidate).toHaveBeenCalled();
    });
  });
});

describe("usePurgeSystem", () => {
  it("invalidates all cached data on success", async () => {
    const { result } = renderHookWithProviders(() => usePurgeSystem());

    await act(() => result.current.mutateAsync({} as never));

    await waitFor(() => {
      expect(mockInvalidateAll).toHaveBeenCalled();
    });
  });
});
