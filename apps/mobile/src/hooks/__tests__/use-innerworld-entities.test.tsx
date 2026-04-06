// @vitest-environment happy-dom
import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { encryptInnerWorldEntityInput } from "@pluralscape/data/transforms/innerworld-entity";
import { act, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  renderHookWithProviders,
  TEST_MASTER_KEY,
  TEST_SYSTEM_ID,
} from "./helpers/render-hook-with-providers.js";

import type {
  InnerWorldEntityEncryptedPayload,
  InnerWorldEntityRaw,
} from "@pluralscape/data/transforms/innerworld-entity";
import type {
  InnerWorldEntityId,
  InnerWorldRegionId,
  MemberId,
  SystemStructureEntityId,
  UnixMillis,
  VisualProperties,
} from "@pluralscape/types";

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
    entity: {
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
        entity: {
          get: {
            useQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
              rq.useQuery({
                queryKey: ["innerworld.entity.get", input],
                queryFn: () => Promise.resolve(fixtures.get("innerworld.entity.get")),
                enabled: opts.enabled as boolean | undefined,
                select: opts.select as ((d: unknown) => unknown) | undefined,
              }),
          },
          list: {
            useInfiniteQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
              rq.useInfiniteQuery({
                queryKey: ["innerworld.entity.list", input],
                queryFn: () => Promise.resolve(fixtures.get("innerworld.entity.list")),
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
  useInnerWorldEntity,
  useInnerWorldEntitiesList,
  useCreateInnerWorldEntity,
  useUpdateInnerWorldEntity,
  useArchiveInnerWorldEntity,
  useRestoreInnerWorldEntity,
  useDeleteInnerWorldEntity,
} = await import("../use-innerworld-entities.js");

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

function makeRawEntity(id: string, payload: InnerWorldEntityEncryptedPayload): InnerWorldEntityRaw {
  const encrypted = encryptInnerWorldEntityInput(payload, TEST_MASTER_KEY);
  return {
    id: id as InnerWorldEntityId,
    systemId: TEST_SYSTEM_ID,
    regionId: null,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    archived: false,
    archivedAt: null,
    ...encrypted,
  };
}

function makeMemberPayload(memberId: string): InnerWorldEntityEncryptedPayload {
  return {
    entityType: "member",
    positionX: 10,
    positionY: 20,
    visual: DEFAULT_VISUAL,
    linkedMemberId: memberId as MemberId,
  };
}

function makeLandmarkPayload(name: string): InnerWorldEntityEncryptedPayload {
  return {
    entityType: "landmark",
    positionX: 30,
    positionY: 40,
    visual: DEFAULT_VISUAL,
    name,
    description: "A test landmark",
  };
}

function makeStructureEntityPayload(structureId: string): InnerWorldEntityEncryptedPayload {
  return {
    entityType: "structure-entity",
    positionX: 50,
    positionY: 60,
    visual: DEFAULT_VISUAL,
    linkedStructureEntityId: structureId as SystemStructureEntityId,
  };
}

beforeEach(() => {
  fixtures.clear();
  vi.clearAllMocks();
});

// ── Query tests ─────────────────────────────────────────────────────
describe("useInnerWorldEntity", () => {
  it("decrypts a member entity variant", async () => {
    fixtures.set("innerworld.entity.get", makeRawEntity("e-1", makeMemberPayload("mem-1")));
    const { result } = renderHookWithProviders(() =>
      useInnerWorldEntity("e-1" as InnerWorldEntityId),
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const data = result.current.data;
    expect(data?.entityType).toBe("member");
    if (data?.entityType === "member") {
      expect(data.linkedMemberId).toBe("mem-1");
    }
    expect(data?.positionX).toBe(10);
    expect(data?.positionY).toBe(20);
    expect(data?.archived).toBe(false);
  });

  it("decrypts a landmark entity variant", async () => {
    fixtures.set("innerworld.entity.get", makeRawEntity("e-2", makeLandmarkPayload("The Forest")));
    const { result } = renderHookWithProviders(() =>
      useInnerWorldEntity("e-2" as InnerWorldEntityId),
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const data = result.current.data;
    expect(data?.entityType).toBe("landmark");
    if (data?.entityType === "landmark") {
      expect(data.name).toBe("The Forest");
      expect(data.description).toBe("A test landmark");
    }
    expect(data?.positionX).toBe(30);
    expect(data?.positionY).toBe(40);
  });

  it("decrypts a structure-entity variant", async () => {
    fixtures.set("innerworld.entity.get", makeRawEntity("e-3", makeStructureEntityPayload("se-1")));
    const { result } = renderHookWithProviders(() =>
      useInnerWorldEntity("e-3" as InnerWorldEntityId),
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const data = result.current.data;
    expect(data?.entityType).toBe("structure-entity");
    if (data?.entityType === "structure-entity") {
      expect(data.linkedStructureEntityId).toBe("se-1");
    }
    expect(data?.positionX).toBe(50);
    expect(data?.positionY).toBe(60);
  });

  it("does not fetch when masterKey is null", () => {
    const { result } = renderHookWithProviders(
      () => useInnerWorldEntity("e-1" as InnerWorldEntityId),
      { masterKey: null },
    );
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });

  it("select is stable across rerenders (useCallback memoization)", async () => {
    fixtures.set("innerworld.entity.get", makeRawEntity("e-1", makeMemberPayload("mem-1")));
    const { result, rerender } = renderHookWithProviders(() =>
      useInnerWorldEntity("e-1" as InnerWorldEntityId),
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const ref1 = result.current.data;
    rerender();
    expect(result.current.data).toBe(ref1);
  });
});

describe("useInnerWorldEntitiesList", () => {
  it("returns decrypted paginated entities", async () => {
    const raw1 = makeRawEntity("e-1", makeMemberPayload("mem-1"));
    const raw2 = makeRawEntity("e-2", makeLandmarkPayload("Lake"));
    fixtures.set("innerworld.entity.list", { data: [raw1, raw2], nextCursor: null });

    const { result } = renderHookWithProviders(() => useInnerWorldEntitiesList());

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const listData = result.current.data;
    const pages = listData && "pages" in listData ? listData.pages : [];
    const [firstPage] = pages;
    const [item0, item1] = firstPage?.data ?? [];
    expect(pages).toHaveLength(1);
    expect(firstPage?.data).toHaveLength(2);
    expect(item0?.entityType).toBe("member");
    expect(item1?.entityType).toBe("landmark");
  });

  it("does not fetch when masterKey is null", () => {
    const { result } = renderHookWithProviders(() => useInnerWorldEntitiesList(), {
      masterKey: null,
    });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("select is stable across rerenders", async () => {
    fixtures.set("innerworld.entity.list", {
      data: [makeRawEntity("e-1", makeMemberPayload("mem-1"))],
      nextCursor: null,
    });
    const { result, rerender } = renderHookWithProviders(() => useInnerWorldEntitiesList());

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const ref1 = result.current.data;
    rerender();
    expect(result.current.data).toBe(ref1);
  });

  it("handles empty page", async () => {
    fixtures.set("innerworld.entity.list", { data: [], nextCursor: null });
    const { result } = renderHookWithProviders(() => useInnerWorldEntitiesList());

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const listData = result.current.data;
    const pages = listData && "pages" in listData ? listData.pages : [];
    const [firstPage] = pages;
    expect(firstPage?.data).toHaveLength(0);
  });
});

// ── Mutation tests ──────────────────────────────────────────────────
describe("useCreateInnerWorldEntity", () => {
  it("invalidates list on success", async () => {
    const { result } = renderHookWithProviders(() => useCreateInnerWorldEntity());

    await act(() => result.current.mutateAsync({} as never));

    await waitFor(() => {
      expect(mockUtils.innerworld.entity.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useUpdateInnerWorldEntity", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useUpdateInnerWorldEntity());

    await act(() => result.current.mutateAsync({ entityId: "e-1" } as never));

    await waitFor(() => {
      expect(mockUtils.innerworld.entity.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        entityId: "e-1",
      });
      expect(mockUtils.innerworld.entity.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useArchiveInnerWorldEntity", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useArchiveInnerWorldEntity());

    await act(() => result.current.mutateAsync({ entityId: "e-2" } as never));

    await waitFor(() => {
      expect(mockUtils.innerworld.entity.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        entityId: "e-2",
      });
      expect(mockUtils.innerworld.entity.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useRestoreInnerWorldEntity", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useRestoreInnerWorldEntity());

    await act(() => result.current.mutateAsync({ entityId: "e-3" } as never));

    await waitFor(() => {
      expect(mockUtils.innerworld.entity.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        entityId: "e-3",
      });
      expect(mockUtils.innerworld.entity.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useDeleteInnerWorldEntity", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useDeleteInnerWorldEntity());

    await act(() => result.current.mutateAsync({ entityId: "e-4" } as never));

    await waitFor(() => {
      expect(mockUtils.innerworld.entity.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        entityId: "e-4",
      });
      expect(mockUtils.innerworld.entity.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

// ── Local source mode tests ───────────────────────────────────────────
function createMockLocalDb(rows: Record<string, unknown>[]) {
  return {
    initialize: vi.fn(),
    queryAll: vi.fn().mockReturnValue(rows),
    queryOne: vi.fn().mockImplementation((_sql: string, params: unknown[]) => {
      const id = params[0];
      return rows.find((r) => r["id"] === id);
    }),
    execute: vi.fn(),
    transaction: vi.fn(),
    close: vi.fn(),
  };
}

const LOCAL_ENTITY_ROW: Record<string, unknown> = {
  id: "e-local-1",
  system_id: TEST_SYSTEM_ID,
  entity_type: "landmark",
  position_x: 100,
  position_y: 200,
  visual:
    '{"color":null,"icon":null,"size":null,"opacity":null,"imageSource":null,"externalUrl":null}',
  region_id: null,
  linked_member_id: null,
  linked_structure_entity_id: null,
  name: "Local Landmark",
  description: "From SQLite",
  archived: 0,
  created_at: 1_700_000_000_000,
  updated_at: 1_700_000_000_000,
};

describe("useInnerWorldEntity (local source)", () => {
  it("returns transformed local row data", async () => {
    const localDb = createMockLocalDb([LOCAL_ENTITY_ROW]);
    const { result } = renderHookWithProviders(
      () => useInnerWorldEntity("e-local-1" as InnerWorldEntityId),
      { querySource: "local", localDb },
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(localDb.queryOne).toHaveBeenCalledWith(expect.stringContaining("innerworld_entities"), [
      "e-local-1",
    ]);
    expect(result.current.data).toMatchObject({
      id: "e-local-1",
      entityType: "landmark",
      positionX: 100,
      positionY: 200,
      name: "Local Landmark",
      description: "From SQLite",
      archived: false,
    });
  });

  it("does not call tRPC in local mode", async () => {
    const localDb = createMockLocalDb([LOCAL_ENTITY_ROW]);
    const { result } = renderHookWithProviders(
      () => useInnerWorldEntity("e-local-1" as InnerWorldEntityId),
      { querySource: "local", localDb },
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data).toMatchObject({ id: "e-local-1" });
  });
});

describe("useInnerWorldEntitiesList (local source)", () => {
  it("returns flat array of transformed rows", async () => {
    const row2 = { ...LOCAL_ENTITY_ROW, id: "e-local-2", name: "Second Entity" };
    const localDb = createMockLocalDb([LOCAL_ENTITY_ROW, row2]);
    const { result } = renderHookWithProviders(() => useInnerWorldEntitiesList(), {
      querySource: "local",
      localDb,
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(localDb.queryAll).toHaveBeenCalledWith(
      expect.stringContaining("innerworld_entities"),
      expect.arrayContaining([TEST_SYSTEM_ID]),
    );

    const data = result.current.data;
    const pages = data && "pages" in data ? data.pages : [];
    expect(pages).toHaveLength(1);
    const items = pages[0] && "data" in pages[0] ? pages[0].data : [];
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ name: "Local Landmark" });
    expect(items[1]).toMatchObject({ name: "Second Entity" });
  });

  it("does not require masterKey in local mode", async () => {
    const localDb = createMockLocalDb([LOCAL_ENTITY_ROW]);
    const { result } = renderHookWithProviders(() => useInnerWorldEntitiesList(), {
      querySource: "local",
      localDb,
      masterKey: null,
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    const data = result.current.data;
    const pages = data && "pages" in data ? data.pages : [];
    const items = pages[0] && "data" in pages[0] ? pages[0].data : [];
    expect(items).toHaveLength(1);
  });

  it("filters by regionId when provided", async () => {
    const regionRow = { ...LOCAL_ENTITY_ROW, id: "e-local-3", region_id: "r-1" };
    const localDb = createMockLocalDb([regionRow]);
    const { result } = renderHookWithProviders(
      () => useInnerWorldEntitiesList({ regionId: "r-1" as InnerWorldRegionId }),
      { querySource: "local", localDb },
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(localDb.queryAll).toHaveBeenCalledWith(
      expect.stringContaining("region_id"),
      expect.arrayContaining(["r-1"]),
    );
  });
});
