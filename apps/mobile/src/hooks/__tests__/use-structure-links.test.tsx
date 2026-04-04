// @vitest-environment happy-dom
import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderHookWithProviders, TEST_SYSTEM_ID } from "./helpers/render-hook-with-providers.js";

// ── Capture tRPC hook calls ──────────────────────────────────────────
type CapturedOpts = Record<string, unknown>;
let lastListOpts: CapturedOpts = {};

const mockUtils = {
  structure: {
    link: {
      list: { invalidate: vi.fn() },
    },
  },
};

vi.mock("@pluralscape/api-client/trpc", async () => {
  const rq = await import("@tanstack/react-query");

  return {
    trpc: {
      structure: {
        link: {
          list: {
            useInfiniteQuery: (_input: unknown, opts: CapturedOpts = {}) => {
              lastListOpts = opts;
              return {
                data: undefined,
                isLoading: true,
                status: "loading",
                fetchStatus: "fetching",
              };
            },
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
                onSuccess: opts.onSuccess as (() => void) | undefined,
              }),
          },
          delete: {
            useMutation: (opts: Record<string, unknown> = {}) =>
              rq.useMutation({
                mutationFn: () => Promise.resolve({}),
                onSuccess: opts.onSuccess as (() => void) | undefined,
              }),
          },
        },
      },
      useUtils: () => mockUtils,
    },
  };
});

const {
  useStructureLinksList,
  useCreateStructureLink,
  useUpdateStructureLink,
  useDeleteStructureLink,
} = await import("../use-structure-links.js");

beforeEach(() => {
  lastListOpts = {};
  vi.clearAllMocks();
});

// ── Query tests ─────────────────────────────────────────────────────

describe("useStructureLinksList", () => {
  it("does not require masterKey (no enabled guard)", () => {
    renderHookWithProviders(() => useStructureLinksList());
    expect(lastListOpts["enabled"]).toBeUndefined();
  });

  it("passes getNextPageParam", () => {
    renderHookWithProviders(() => useStructureLinksList());
    expect(lastListOpts["getNextPageParam"]).toBeTypeOf("function");
  });
});

// ── Mutation tests ──────────────────────────────────────────────────

describe("useCreateStructureLink", () => {
  it("invalidates list on success", async () => {
    const { result } = renderHookWithProviders(() => useCreateStructureLink());

    await act(() => result.current.mutateAsync({} as never));

    await waitFor(() => {
      expect(mockUtils.structure.link.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useUpdateStructureLink", () => {
  it("invalidates list on success", async () => {
    const { result } = renderHookWithProviders(() => useUpdateStructureLink());

    await act(() => result.current.mutateAsync({} as never));

    await waitFor(() => {
      expect(mockUtils.structure.link.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useDeleteStructureLink", () => {
  it("invalidates list on success", async () => {
    const { result } = renderHookWithProviders(() => useDeleteStructureLink());

    await act(() => result.current.mutateAsync({} as never));

    await waitFor(() => {
      expect(mockUtils.structure.link.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});
