// @vitest-environment happy-dom
import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderHookWithProviders, TEST_SYSTEM_ID } from "./helpers/render-hook-with-providers.js";

// ── Capture tRPC hook calls ──────────────────────────────────────────
type CapturedOpts = Record<string, unknown>;
let lastListOpts: CapturedOpts = {};

const mockUtils = {
  structure: {
    association: {
      list: { invalidate: vi.fn() },
    },
  },
};

vi.mock("@pluralscape/api-client/trpc", async () => {
  const rq = await import("@tanstack/react-query");

  return {
    trpc: {
      structure: {
        association: {
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
  useStructureAssociationsList,
  useCreateStructureAssociation,
  useDeleteStructureAssociation,
} = await import("../use-structure-associations.js");

beforeEach(() => {
  lastListOpts = {};
  vi.clearAllMocks();
});

// ── Query tests ─────────────────────────────────────────────────────

describe("useStructureAssociationsList", () => {
  it("does not require masterKey (no enabled guard)", () => {
    renderHookWithProviders(() => useStructureAssociationsList());
    expect(lastListOpts["enabled"]).toBeUndefined();
  });

  it("passes getNextPageParam", () => {
    renderHookWithProviders(() => useStructureAssociationsList());
    expect(lastListOpts["getNextPageParam"]).toBeTypeOf("function");
  });
});

// ── Mutation tests ──────────────────────────────────────────────────

describe("useCreateStructureAssociation", () => {
  it("invalidates list on success", async () => {
    const { result } = renderHookWithProviders(() => useCreateStructureAssociation());

    await act(() => result.current.mutateAsync({} as never));

    await waitFor(() => {
      expect(mockUtils.structure.association.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useDeleteStructureAssociation", () => {
  it("invalidates list on success", async () => {
    const { result } = renderHookWithProviders(() => useDeleteStructureAssociation());

    await act(() => result.current.mutateAsync({} as never));

    await waitFor(() => {
      expect(mockUtils.structure.association.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});
