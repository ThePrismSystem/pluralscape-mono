// @vitest-environment happy-dom
import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { encryptStructureEntityInput } from "@pluralscape/data/transforms/structure-entity";
import { act, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  renderHookWithProviders,
  TEST_MASTER_KEY,
  TEST_SYSTEM_ID,
} from "./helpers/render-hook-with-providers.js";

import type { StructureEntityRaw } from "@pluralscape/data/transforms/structure-entity";
import type {
  SystemStructureEntityId,
  SystemStructureEntityTypeId,
  UnixMillis,
} from "@pluralscape/types";

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
    entity: {
      get: { invalidate: vi.fn() },
      list: { invalidate: vi.fn() },
    },
    link: {
      list: { invalidate: vi.fn() },
    },
    memberLink: {
      list: { invalidate: vi.fn() },
    },
  },
};

vi.mock("@pluralscape/api-client/trpc", async () => {
  const rq = await import("@tanstack/react-query");

  return {
    trpc: {
      structure: {
        entity: {
          get: {
            useQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
              rq.useQuery({
                queryKey: ["structure.entity.get", input],
                queryFn: () => Promise.resolve(fixtures.get("structure.entity.get")),
                enabled: opts.enabled as boolean | undefined,
                select: opts.select as ((d: unknown) => unknown) | undefined,
              }),
          },
          getHierarchy: {
            useQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
              rq.useQuery({
                queryKey: ["structure.entity.getHierarchy", input],
                queryFn: () => Promise.resolve(fixtures.get("structure.entity.getHierarchy")),
                enabled: opts.enabled as boolean | undefined,
                select: opts.select as ((d: unknown) => unknown) | undefined,
              }),
          },
          list: {
            useInfiniteQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
              rq.useInfiniteQuery({
                queryKey: ["structure.entity.list", input],
                queryFn: () => Promise.resolve(fixtures.get("structure.entity.list")),
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
        link: {},
        memberLink: {},
      },
      useUtils: () => mockUtils,
    },
  };
});

const {
  useStructureEntity,
  useStructureEntityHierarchy,
  useStructureEntitiesList,
  useCreateStructureEntity,
  useUpdateStructureEntity,
  useArchiveStructureEntity,
  useRestoreStructureEntity,
  useDeleteStructureEntity,
} = await import("../use-structure-entities.js");

const NOW = 1_700_000_000_000 as UnixMillis;
const ENTITY_TYPE_ID = "stet_default" as SystemStructureEntityTypeId;

function makeRawEntity(id: string): StructureEntityRaw {
  const encrypted = encryptStructureEntityInput(
    {
      name: `Entity ${id}`,
      description: "A test entity",
      emoji: null,
      color: null,
      imageSource: null,
    },
    TEST_MASTER_KEY,
  );
  return {
    id: id as SystemStructureEntityId,
    systemId: TEST_SYSTEM_ID,
    entityTypeId: ENTITY_TYPE_ID,
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

// ── Query tests ─────────────────────────────────────────────────────

describe("useStructureEntity", () => {
  it("returns decrypted entity data", async () => {
    fixtures.set("structure.entity.get", makeRawEntity("ste_1"));
    const { result } = renderHookWithProviders(() =>
      useStructureEntity("ste_1" as SystemStructureEntityId),
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data?.name).toBe("Entity ste_1");
    expect(result.current.data?.description).toBe("A test entity");
    expect(result.current.data?.archived).toBe(false);
  });

  it("does not fetch when masterKey is null", () => {
    const { result } = renderHookWithProviders(
      () => useStructureEntity("ste_1" as SystemStructureEntityId),
      { masterKey: null },
    );
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });

  it("select is stable across rerenders", async () => {
    fixtures.set("structure.entity.get", makeRawEntity("ste_1"));
    const { result, rerender } = renderHookWithProviders(() =>
      useStructureEntity("ste_1" as SystemStructureEntityId),
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const ref1 = result.current.data;
    rerender();
    expect(result.current.data).toBe(ref1);
  });
});

describe("useStructureEntityHierarchy", () => {
  it("returns hierarchy data without encryption guard", async () => {
    const hierarchyData = { ancestors: [], children: [] };
    fixtures.set("structure.entity.getHierarchy", hierarchyData);
    const { result } = renderHookWithProviders(() =>
      useStructureEntityHierarchy("ste_1" as SystemStructureEntityId),
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data).toEqual(hierarchyData);
  });
});

describe("useStructureEntitiesList", () => {
  it("returns decrypted paginated entities", async () => {
    fixtures.set("structure.entity.list", {
      data: [makeRawEntity("ste_1"), makeRawEntity("ste_2")],
      nextCursor: null,
    });
    const { result } = renderHookWithProviders(() => useStructureEntitiesList());

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const pages = result.current.data?.pages ?? [];
    const [firstPage] = pages;
    const [item0, item1] = firstPage?.data ?? [];
    expect(pages).toHaveLength(1);
    expect(firstPage?.data).toHaveLength(2);
    expect(item0?.name).toBe("Entity ste_1");
    expect(item1?.name).toBe("Entity ste_2");
  });

  it("does not fetch when masterKey is null", () => {
    const { result } = renderHookWithProviders(() => useStructureEntitiesList(), {
      masterKey: null,
    });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("select is stable across rerenders", async () => {
    fixtures.set("structure.entity.list", {
      data: [makeRawEntity("ste_1")],
      nextCursor: null,
    });
    const { result, rerender } = renderHookWithProviders(() => useStructureEntitiesList());

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const ref1 = result.current.data;
    rerender();
    expect(result.current.data).toBe(ref1);
  });
});

// ── Mutation tests ──────────────────────────────────────────────────

describe("useCreateStructureEntity", () => {
  it("invalidates list on success", async () => {
    const { result } = renderHookWithProviders(() => useCreateStructureEntity());

    await act(() => result.current.mutateAsync({} as never));

    await waitFor(() => {
      expect(mockUtils.structure.entity.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useUpdateStructureEntity", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useUpdateStructureEntity());

    await act(() => result.current.mutateAsync({ entityId: "ste_1" } as never));

    await waitFor(() => {
      expect(mockUtils.structure.entity.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        entityId: "ste_1",
      });
      expect(mockUtils.structure.entity.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useArchiveStructureEntity", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useArchiveStructureEntity());

    await act(() => result.current.mutateAsync({ entityId: "ste_2" } as never));

    await waitFor(() => {
      expect(mockUtils.structure.entity.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        entityId: "ste_2",
      });
      expect(mockUtils.structure.entity.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useRestoreStructureEntity", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useRestoreStructureEntity());

    await act(() => result.current.mutateAsync({ entityId: "ste_3" } as never));

    await waitFor(() => {
      expect(mockUtils.structure.entity.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        entityId: "ste_3",
      });
      expect(mockUtils.structure.entity.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useDeleteStructureEntity", () => {
  it("invalidates get, list, and cross-resource link lists on success", async () => {
    const { result } = renderHookWithProviders(() => useDeleteStructureEntity());

    await act(() => result.current.mutateAsync({ entityId: "ste_4" } as never));

    await waitFor(() => {
      expect(mockUtils.structure.entity.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        entityId: "ste_4",
      });
      expect(mockUtils.structure.entity.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
      // Cross-resource: cascade removes dependent links
      expect(mockUtils.structure.link.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
      expect(mockUtils.structure.memberLink.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});
