// @vitest-environment happy-dom
import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { encryptStructureEntityTypeInput } from "@pluralscape/data/transforms/structure-entity-type";
import { brandId } from "@pluralscape/types";
import { act, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  renderHookWithProviders,
  TEST_MASTER_KEY,
  TEST_SYSTEM_ID,
} from "./helpers/render-hook-with-providers.js";

import type { StructureEntityTypeRaw } from "@pluralscape/data/transforms/structure-entity-type";
import type { SystemStructureEntityTypeId, UnixMillis } from "@pluralscape/types";

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
});

const { fixtures } = vi.hoisted(() => {
  const store = new Map<string, unknown>();
  return { fixtures: store };
});

const mockUtils = {
  structure: {
    entityType: {
      get: { invalidate: vi.fn() },
      list: { invalidate: vi.fn() },
    },
    entity: {
      list: { invalidate: vi.fn() },
    },
  },
};

vi.mock("@pluralscape/api-client/trpc", async () => {
  const rq = await import("@tanstack/react-query");

  return {
    trpc: {
      structure: {
        entityType: {
          get: {
            useQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
              rq.useQuery({
                queryKey: ["structure.entityType.get", input],
                queryFn: () => Promise.resolve(fixtures.get("structure.entityType.get")),
                enabled: opts.enabled as boolean | undefined,
                select: opts.select as ((d: unknown) => unknown) | undefined,
              }),
          },
          list: {
            useInfiniteQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
              rq.useInfiniteQuery({
                queryKey: ["structure.entityType.list", input],
                queryFn: () => Promise.resolve(fixtures.get("structure.entityType.list")),
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
        entity: {},
      },
      useUtils: () => mockUtils,
    },
  };
});

const {
  useStructureEntityType,
  useStructureEntityTypesList,
  useCreateStructureEntityType,
  useUpdateStructureEntityType,
  useArchiveStructureEntityType,
  useRestoreStructureEntityType,
  useDeleteStructureEntityType,
} = await import("../use-structure-entity-types.js");

const NOW = 1_700_000_000_000 as UnixMillis;

function makeRawEntityType(id: string): StructureEntityTypeRaw {
  const encrypted = encryptStructureEntityTypeInput(
    {
      name: `Type ${id}`,
      description: "A test entity type",
      emoji: null,
      color: null,
      imageSource: null,
    },
    TEST_MASTER_KEY,
  );
  return {
    id: brandId<SystemStructureEntityTypeId>(id),
    systemId: TEST_SYSTEM_ID,
    sortOrder: 0,
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

describe("useStructureEntityType", () => {
  it("returns decrypted entity type data", async () => {
    fixtures.set("structure.entityType.get", makeRawEntityType("stet_1"));
    const { result } = renderHookWithProviders(() =>
      useStructureEntityType(brandId<SystemStructureEntityTypeId>("stet_1")),
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.name).toBe("Type stet_1");
    expect(result.current.data?.description).toBe("A test entity type");
    expect(result.current.data?.archived).toBe(false);
  });

  it("does not fetch when masterKey is null", () => {
    const { result } = renderHookWithProviders(
      () => useStructureEntityType(brandId<SystemStructureEntityTypeId>("stet_1")),
      { masterKey: null },
    );
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });

  it("select is stable across rerenders", async () => {
    fixtures.set("structure.entityType.get", makeRawEntityType("stet_1"));
    const { result, rerender } = renderHookWithProviders(() =>
      useStructureEntityType(brandId<SystemStructureEntityTypeId>("stet_1")),
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const ref1 = result.current.data;
    rerender();
    expect(result.current.data).toBe(ref1);
  });
});

describe("useStructureEntityTypesList", () => {
  it("returns decrypted paginated entity types", async () => {
    fixtures.set("structure.entityType.list", {
      data: [makeRawEntityType("stet_1"), makeRawEntityType("stet_2")],
      nextCursor: null,
    });
    const { result } = renderHookWithProviders(() => useStructureEntityTypesList());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const data = result.current.data;
    const pages = data && "pages" in data ? data.pages : [];
    const firstPage = pages[0];
    const items = firstPage && "data" in firstPage ? firstPage.data : [];
    expect(pages).toHaveLength(1);
    expect(items).toHaveLength(2);
    expect(items[0]?.name).toBe("Type stet_1");
    expect(items[1]?.name).toBe("Type stet_2");
  });

  it("does not fetch when masterKey is null", () => {
    const { result } = renderHookWithProviders(() => useStructureEntityTypesList(), {
      masterKey: null,
    });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("select is stable across rerenders", async () => {
    fixtures.set("structure.entityType.list", {
      data: [makeRawEntityType("stet_1")],
      nextCursor: null,
    });
    const { result, rerender } = renderHookWithProviders(() => useStructureEntityTypesList());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const ref1 = result.current.data;
    rerender();
    expect(result.current.data).toBe(ref1);
  });
});

describe("useCreateStructureEntityType", () => {
  it("invalidates list on success", async () => {
    const { result } = renderHookWithProviders(() => useCreateStructureEntityType());

    await act(() => result.current.mutateAsync({} as never));

    await waitFor(() => {
      expect(mockUtils.structure.entityType.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useUpdateStructureEntityType", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useUpdateStructureEntityType());

    await act(() => result.current.mutateAsync({ entityTypeId: "stet_1" } as never));

    await waitFor(() => {
      expect(mockUtils.structure.entityType.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        entityTypeId: "stet_1",
      });
      expect(mockUtils.structure.entityType.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useArchiveStructureEntityType", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useArchiveStructureEntityType());

    await act(() => result.current.mutateAsync({ entityTypeId: "stet_2" } as never));

    await waitFor(() => {
      expect(mockUtils.structure.entityType.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        entityTypeId: "stet_2",
      });
      expect(mockUtils.structure.entityType.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useRestoreStructureEntityType", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useRestoreStructureEntityType());

    await act(() => result.current.mutateAsync({ entityTypeId: "stet_3" } as never));

    await waitFor(() => {
      expect(mockUtils.structure.entityType.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        entityTypeId: "stet_3",
      });
      expect(mockUtils.structure.entityType.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useDeleteStructureEntityType", () => {
  it("invalidates get, list, and entity list on success", async () => {
    const { result } = renderHookWithProviders(() => useDeleteStructureEntityType());

    await act(() => result.current.mutateAsync({ entityTypeId: "stet_4" } as never));

    await waitFor(() => {
      expect(mockUtils.structure.entityType.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        entityTypeId: "stet_4",
      });
      expect(mockUtils.structure.entityType.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
      // Cross-resource: cascade removes entities of this type
      expect(mockUtils.structure.entity.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});
