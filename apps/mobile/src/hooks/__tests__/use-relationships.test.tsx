// @vitest-environment happy-dom
import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { brandId } from "@pluralscape/types";
import { act, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { makeRawRelationship } from "../../__tests__/factories.js";

import { renderHookWithProviders, TEST_SYSTEM_ID } from "./helpers/render-hook-with-providers.js";

import type { RelationshipId } from "@pluralscape/types";

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
});

const { fixtures } = vi.hoisted(() => {
  const store = new Map<string, unknown>();
  return { fixtures: store };
});

const mockUtils = {
  relationship: {
    get: { invalidate: vi.fn() },
    list: { invalidate: vi.fn() },
  },
};

vi.mock("@pluralscape/api-client/trpc", async () => {
  const rq = await import("@tanstack/react-query");

  return {
    trpc: {
      relationship: {
        get: {
          useQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
            rq.useQuery({
              queryKey: ["relationship.get", input],
              queryFn: () => Promise.resolve(fixtures.get("relationship.get")),
              enabled: opts.enabled as boolean | undefined,
              select: opts.select as ((d: unknown) => unknown) | undefined,
            }),
        },
        list: {
          useInfiniteQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
            rq.useInfiniteQuery({
              queryKey: ["relationship.list", input],
              queryFn: () => Promise.resolve(fixtures.get("relationship.list")),
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
      useUtils: () => mockUtils,
    },
  };
});

const {
  useRelationship,
  useRelationshipsList,
  useCreateRelationship,
  useUpdateRelationship,
  useArchiveRelationship,
  useRestoreRelationship,
  useDeleteRelationship,
} = await import("../use-relationships.js");

beforeEach(() => {
  fixtures.clear();
  vi.clearAllMocks();
});

// ── Query tests ─────────────────────────────────────────────────────

describe("useRelationship", () => {
  it("returns decrypted relationship data", async () => {
    fixtures.set("relationship.get", makeRawRelationship("rel_1"));
    const { result } = renderHookWithProviders(() =>
      useRelationship(brandId<RelationshipId>("rel_1")),
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.label).toBe("Label rel_1");
    expect(result.current.data?.type).toBe("sibling");
    expect(result.current.data?.archived).toBe(false);
  });

  it("returns label: null when encryptedData is null", async () => {
    fixtures.set("relationship.get", makeRawRelationship("rel_2", { encryptedData: null }));
    const { result } = renderHookWithProviders(() =>
      useRelationship(brandId<RelationshipId>("rel_2")),
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.label).toBeNull();
  });

  it("does not fetch when masterKey is null", () => {
    const { result } = renderHookWithProviders(
      () => useRelationship(brandId<RelationshipId>("rel_1")),
      {
        masterKey: null,
      },
    );
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });

  it("select is stable across rerenders", async () => {
    fixtures.set("relationship.get", makeRawRelationship("rel_1"));
    const { result, rerender } = renderHookWithProviders(() =>
      useRelationship(brandId<RelationshipId>("rel_1")),
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const ref1 = result.current.data;
    rerender();
    expect(result.current.data).toBe(ref1);
  });
});

describe("useRelationshipsList", () => {
  it("returns decrypted paginated relationships", async () => {
    fixtures.set("relationship.list", {
      data: [makeRawRelationship("rel_1"), makeRawRelationship("rel_2")],
      nextCursor: null,
    });
    const { result } = renderHookWithProviders(() => useRelationshipsList());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const data = result.current.data;
    const pages = data && "pages" in data ? data.pages : [];
    const firstPage = pages[0];
    const items = firstPage && "data" in firstPage ? firstPage.data : [];
    expect(pages).toHaveLength(1);
    expect(items).toHaveLength(2);
    expect(items[0]?.label).toBe("Label rel_1");
    expect(items[1]?.label).toBe("Label rel_2");
  });

  it("does not fetch when masterKey is null", () => {
    const { result } = renderHookWithProviders(() => useRelationshipsList(), {
      masterKey: null,
    });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("select is stable across rerenders", async () => {
    fixtures.set("relationship.list", {
      data: [makeRawRelationship("rel_1")],
      nextCursor: null,
    });
    const { result, rerender } = renderHookWithProviders(() => useRelationshipsList());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const ref1 = result.current.data;
    rerender();
    expect(result.current.data).toBe(ref1);
  });

  it("handles empty page", async () => {
    fixtures.set("relationship.list", { data: [], nextCursor: null });
    const { result } = renderHookWithProviders(() => useRelationshipsList());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const data = result.current.data;
    const pages = data && "pages" in data ? data.pages : [];
    const firstPage = pages[0];
    const items = firstPage && "data" in firstPage ? firstPage.data : [];
    expect(items).toHaveLength(0);
  });
});

// ── Mutation tests ──────────────────────────────────────────────────

describe("useCreateRelationship", () => {
  it("invalidates list on success", async () => {
    const { result } = renderHookWithProviders(() => useCreateRelationship());

    await act(() => result.current.mutateAsync({} as never));

    await waitFor(() => {
      expect(mockUtils.relationship.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useUpdateRelationship", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useUpdateRelationship());

    await act(() => result.current.mutateAsync({ relationshipId: "rel_1" } as never));

    await waitFor(() => {
      expect(mockUtils.relationship.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        relationshipId: "rel_1",
      });
      expect(mockUtils.relationship.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useArchiveRelationship", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useArchiveRelationship());

    await act(() => result.current.mutateAsync({ relationshipId: "rel_2" } as never));

    await waitFor(() => {
      expect(mockUtils.relationship.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        relationshipId: "rel_2",
      });
      expect(mockUtils.relationship.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useRestoreRelationship", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useRestoreRelationship());

    await act(() => result.current.mutateAsync({ relationshipId: "rel_3" } as never));

    await waitFor(() => {
      expect(mockUtils.relationship.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        relationshipId: "rel_3",
      });
      expect(mockUtils.relationship.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useDeleteRelationship", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useDeleteRelationship());

    await act(() => result.current.mutateAsync({ relationshipId: "rel_4" } as never));

    await waitFor(() => {
      expect(mockUtils.relationship.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        relationshipId: "rel_4",
      });
      expect(mockUtils.relationship.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});
