// @vitest-environment happy-dom
import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderHookWithProviders, TEST_SYSTEM_ID } from "./helpers/render-hook-with-providers.js";

import type { LocalDatabase } from "../../data/local-database.js";
import type { DataListQuery, DataQuery } from "../types.js";
import type { SystemId } from "@pluralscape/types";

// ── Fixture registry (accessible from vi.mock via hoisting) ──────────
const { fixtures } = vi.hoisted(() => {
  const store = new Map<string, unknown>();
  return { fixtures: store };
});

// ── Mock utils for mutation invalidation tracking ────────────────────
const mockUtils = {
  member: {
    get: { invalidate: vi.fn() },
    list: { invalidate: vi.fn() },
  },
};

// ── tRPC mock backed by real React Query ─────────────────────────────
vi.mock("@pluralscape/api-client/trpc", async () => {
  const rq = await import("@tanstack/react-query");

  return {
    trpc: {
      member: {
        get: {
          useQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
            rq.useQuery({
              queryKey: ["member.get", input],
              queryFn: () => Promise.resolve(fixtures.get("member.get")),
              enabled: opts.enabled as boolean | undefined,
              select: opts.select as ((d: unknown) => unknown) | undefined,
            }),
        },
        list: {
          useInfiniteQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
            rq.useInfiniteQuery({
              queryKey: ["member.list", input],
              queryFn: () => Promise.resolve(fixtures.get("member.list")),
              enabled: opts.enabled as boolean | undefined,
              select: opts.select as ((d: unknown) => unknown) | undefined,
              getNextPageParam: opts.getNextPageParam as (lp: unknown) => unknown,
              initialPageParam: undefined,
            }),
        },
        create: {
          useMutation: (opts: Record<string, unknown> = {}) =>
            rq.useMutation({
              mutationFn: () => Promise.resolve({ id: "new-1" }),
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
const { trpc } = await import("@pluralscape/api-client/trpc");
const {
  useOfflineFirstQuery,
  useOfflineFirstInfiniteQuery,
  useDomainMutation,
  useRemoteOnlyQuery,
} = await import("../factories.js");

// ── Helpers ──────────────────────────────────────────────────────────

interface RawEntity {
  readonly name: string;
}

interface DecEntity {
  readonly decryptedName: string;
}

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

// ── Test hooks that exercise each factory ────────────────────────────

function useEncryptedGet(id: string) {
  return useOfflineFirstQuery<RawEntity, DecEntity>({
    queryKey: ["test-entity", id],
    table: "test_entities",
    entityId: id,
    rowTransform: (row) => ({ decryptedName: String(row["name"]) }),
    decrypt: (raw) => ({ decryptedName: `decrypted:${raw.name}` }),
    useRemote: ({ systemId, enabled, select }) =>
      trpc.member.get.useQuery({ systemId, memberId: id as never }, { enabled, select } as Record<
        string,
        unknown
      >) as DataQuery<DecEntity>,
  });
}

function usePlaintextGet(id: string) {
  return useOfflineFirstQuery<RawEntity, RawEntity>({
    queryKey: ["test-plain", id],
    table: "test_entities",
    entityId: id,
    rowTransform: (row) => ({ name: String(row["name"]) }),
    useRemote: ({ systemId, enabled, select }) =>
      trpc.member.get.useQuery({ systemId, memberId: id as never }, { enabled, select } as Record<
        string,
        unknown
      >) as DataQuery<RawEntity>,
  });
}

function useLocalGet(
  id: string,
  localQueryFn?: (db: LocalDatabase, systemId: SystemId) => DecEntity,
) {
  return useOfflineFirstQuery<RawEntity, DecEntity>({
    queryKey: ["test-local", id],
    table: "test_entities",
    entityId: id,
    rowTransform: (row) => ({ decryptedName: String(row["name"]) }),
    decrypt: (raw) => ({ decryptedName: `decrypted:${raw.name}` }),
    localQueryFn,
    useRemote: ({ systemId, enabled, select }) =>
      trpc.member.get.useQuery({ systemId, memberId: id as never }, { enabled, select } as Record<
        string,
        unknown
      >) as DataQuery<DecEntity>,
  });
}

function useEncryptedList() {
  return useOfflineFirstInfiniteQuery<RawEntity, DecEntity>({
    queryKey: ["test-list"],
    table: "test_entities",
    rowTransform: (row) => ({ decryptedName: String(row["name"]) }),
    decrypt: (raw) => ({ decryptedName: `decrypted:${raw.name}` }),
    useRemote: ({ systemId, enabled, select }) =>
      trpc.member.list.useInfiniteQuery({ systemId, limit: 20 }, {
        enabled,
        select,
        getNextPageParam: (lp: { nextCursor: string | null }) => lp.nextCursor,
      } as never) as DataListQuery<DecEntity>,
  });
}

function usePlaintextList() {
  return useOfflineFirstInfiniteQuery<RawEntity, RawEntity>({
    queryKey: ["test-plain-list"],
    table: "test_entities",
    rowTransform: (row) => ({ name: String(row["name"]) }),
    useRemote: ({ systemId, enabled, select }) =>
      trpc.member.list.useInfiniteQuery({ systemId, limit: 20 }, {
        enabled,
        select,
        getNextPageParam: (lp: { nextCursor: string | null }) => lp.nextCursor,
      } as never) as DataListQuery<RawEntity>,
  });
}

beforeEach(() => {
  fixtures.clear();
  vi.clearAllMocks();
});

// ── useOfflineFirstQuery — encrypted mode ───────────────────────────
describe("useOfflineFirstQuery (encrypted)", () => {
  it("returns decrypted data when masterKey is available", async () => {
    fixtures.set("member.get", { name: "Alice" });
    const { result } = renderHookWithProviders(() => useEncryptedGet("e-1"));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data?.decryptedName).toBe("decrypted:Alice");
  });

  it("does NOT fetch when masterKey is null", () => {
    fixtures.set("member.get", { name: "Alice" });
    const { result } = renderHookWithProviders(() => useEncryptedGet("e-1"), {
      masterKey: null,
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });

  it("select callback is stable across rerenders", async () => {
    fixtures.set("member.get", { name: "Alice" });
    const { result, rerender } = renderHookWithProviders(() => useEncryptedGet("e-1"));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const ref1 = result.current.data;
    rerender();
    expect(result.current.data).toBe(ref1);
  });
});

// ── useOfflineFirstQuery — plaintext mode ───────────────────────────
describe("useOfflineFirstQuery (plaintext)", () => {
  it("returns data without decryption", async () => {
    fixtures.set("member.get", { name: "Bob" });
    const { result } = renderHookWithProviders(() => usePlaintextGet("p-1"));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    // Plaintext: no select transform, raw data passes through directly
    expect(result.current.data?.name).toBe("Bob");
  });

  it("fetches even when masterKey is null", async () => {
    fixtures.set("member.get", { name: "Bob" });
    const { result } = renderHookWithProviders(() => usePlaintextGet("p-1"), {
      masterKey: null,
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data?.name).toBe("Bob");
  });
});

// ── useOfflineFirstQuery — local source ─────────────────────────────
describe("useOfflineFirstQuery (local source)", () => {
  it("returns data from local SQLite when source is local", async () => {
    const localDb = createMockLocalDb([{ id: "loc-1", name: "Local Entity" }]);
    const { result } = renderHookWithProviders(() => useLocalGet("loc-1"), {
      querySource: "local",
      localDb,
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(localDb.queryOne).toHaveBeenCalledWith(expect.stringContaining("test_entities"), [
      "loc-1",
    ]);
    expect(result.current.data?.decryptedName).toBe("Local Entity");
  });

  it("uses localQueryFn override when provided", async () => {
    const localDb = createMockLocalDb([]);
    const customFn = vi.fn().mockReturnValue({ decryptedName: "custom-result" });

    const { result } = renderHookWithProviders(
      () => useLocalGet("loc-2", customFn as (db: LocalDatabase, systemId: SystemId) => DecEntity),
      { querySource: "local", localDb },
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(customFn).toHaveBeenCalledWith(localDb, TEST_SYSTEM_ID);
    expect(localDb.queryOne).not.toHaveBeenCalled();
    expect(result.current.data?.decryptedName).toBe("custom-result");
  });
});

// ── useOfflineFirstInfiniteQuery — encrypted mode ───────────────────
describe("useOfflineFirstInfiniteQuery (encrypted)", () => {
  it("returns decrypted paginated data", async () => {
    fixtures.set("member.list", { data: [{ name: "A" }, { name: "B" }], nextCursor: null });
    const { result } = renderHookWithProviders(() => useEncryptedList());

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    const data = result.current.data;
    const pages = data && "pages" in data ? data.pages : [];
    const [firstPage] = pages;
    const items = firstPage && "data" in firstPage ? firstPage.data : [];
    expect(pages).toHaveLength(1);
    expect(items).toHaveLength(2);
    expect(items[0]?.decryptedName).toBe("decrypted:A");
    expect(items[1]?.decryptedName).toBe("decrypted:B");
  });

  it("does NOT fetch when masterKey is null", () => {
    fixtures.set("member.list", { data: [{ name: "A" }], nextCursor: null });
    const { result } = renderHookWithProviders(() => useEncryptedList(), {
      masterKey: null,
    });
    expect(result.current.fetchStatus).toBe("idle");
  });
});

// ── useOfflineFirstInfiniteQuery — local source ─────────────────────
describe("useOfflineFirstInfiniteQuery (local source)", () => {
  it("default SQL includes LIMIT and OFFSET", async () => {
    const localDb = createMockLocalDb([{ id: "l-1", name: "Local" }]);
    const { result } = renderHookWithProviders(() => usePlaintextList(), {
      querySource: "local",
      localDb,
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(localDb.queryAll).toHaveBeenCalledWith(
      expect.stringMatching(/LIMIT 20 OFFSET 0/),
      expect.any(Array),
    );
  });

  it("default SQL excludes archived rows when includeArchived is false", async () => {
    const localDb = createMockLocalDb([]);
    const { result } = renderHookWithProviders(() => usePlaintextList(), {
      querySource: "local",
      localDb,
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(localDb.queryAll).toHaveBeenCalledWith(
      expect.stringContaining("AND archived = 0"),
      expect.any(Array),
    );
  });

  it("returns InfiniteData with pages containing data and nextCursor", async () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({
      id: `l-${String(i)}`,
      name: `Item ${String(i)}`,
    }));
    const localDb = createMockLocalDb(rows);
    const { result } = renderHookWithProviders(() => usePlaintextList(), {
      querySource: "local",
      localDb,
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    const data = result.current.data;
    const pages = data && "pages" in data ? data.pages : [];
    expect(pages).toHaveLength(1);
    const firstPage = pages[0];
    expect(firstPage).toHaveProperty("data");
    expect(firstPage).toHaveProperty("nextCursor", null); // fewer than 20 items → no next page
    const items = firstPage && "data" in firstPage ? firstPage.data : [];
    expect(items).toHaveLength(5);
  });

  it("sets nextCursor when page is full", async () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({
      id: `l-${String(i)}`,
      name: `Item ${String(i)}`,
    }));
    const localDb = createMockLocalDb(rows);
    const { result } = renderHookWithProviders(() => usePlaintextList(), {
      querySource: "local",
      localDb,
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    const data = result.current.data;
    const pages = data && "pages" in data ? data.pages : [];
    const firstPage = pages[0];
    // 20 rows returned = full page → nextCursor should be offset "20"
    expect(firstPage).toHaveProperty("nextCursor", "20");
  });

  it("custom localQueryFn receives pagination params", async () => {
    const customFn = vi.fn().mockReturnValue([{ name: "custom" }]);
    const localDb = createMockLocalDb([]);

    function useCustomLocalList() {
      return useOfflineFirstInfiniteQuery<RawEntity, RawEntity>({
        queryKey: ["test-custom-local-list"],
        table: "test_entities",
        rowTransform: (row) => ({ name: String(row["name"]) }),
        localQueryFn: customFn as (
          db: LocalDatabase,
          systemId: SystemId,
          pagination: { offset: number; limit: number },
        ) => readonly RawEntity[],
        useRemote: ({ systemId, enabled, select }) =>
          trpc.member.list.useInfiniteQuery({ systemId, limit: 20 }, {
            enabled,
            select,
            getNextPageParam: (lp: { nextCursor: string | null }) => lp.nextCursor,
          } as never) as DataListQuery<RawEntity>,
      });
    }

    const { result } = renderHookWithProviders(() => useCustomLocalList(), {
      querySource: "local",
      localDb,
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(customFn).toHaveBeenCalledWith(localDb, TEST_SYSTEM_ID, { offset: 0, limit: 20 });
    expect(localDb.queryAll).not.toHaveBeenCalled();
  });
});

// ── useOfflineFirstInfiniteQuery — plaintext mode ───────────────────
describe("useOfflineFirstInfiniteQuery (plaintext)", () => {
  it("returns paginated data without decryption", async () => {
    fixtures.set("member.list", { data: [{ name: "X" }, { name: "Y" }], nextCursor: null });
    const { result } = renderHookWithProviders(() => usePlaintextList());

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    const data = result.current.data;
    const pages = data && "pages" in data ? data.pages : [];
    const [firstPage] = pages;
    const items = firstPage && "data" in firstPage ? firstPage.data : [];
    expect(pages).toHaveLength(1);
    expect(items).toHaveLength(2);
    expect(items[0]?.name).toBe("X");
    expect(items[1]?.name).toBe("Y");
  });
});

// ── useDomainMutation ───────────────────────────────────────────────
describe("useDomainMutation", () => {
  it("calls onInvalidate with utils, systemId, data, and vars on success", async () => {
    const onInvalidate = vi.fn();

    function useTestMutation() {
      return useDomainMutation<{ id: string }, { input: string }>({
        useMutation: (opts) =>
          trpc.member.create.useMutation({
            onSuccess: opts.onSuccess as (() => void) | undefined,
          }) as never,
        onInvalidate,
      });
    }

    const { result } = renderHookWithProviders(() => useTestMutation());

    await act(() => result.current.mutateAsync({} as never));

    await waitFor(() => {
      expect(onInvalidate).toHaveBeenCalledTimes(1);
    });

    const [utils, systemId, data, vars] = onInvalidate.mock.calls[0] as [
      unknown,
      SystemId,
      unknown,
      unknown,
    ];
    expect(utils).toBe(mockUtils);
    expect(systemId).toBe(TEST_SYSTEM_ID);
    // data and vars come from the mutation mock's mutationFn/mutateAsync call
    expect(data).toEqual({ id: "new-1" });
    expect(vars).toEqual({});
  });
});

// ── useRemoteOnlyQuery ───────────────────────────────────────────────
function useRemoteOnlyGet(id: string) {
  return useRemoteOnlyQuery<RawEntity>({
    useRemote: ({ systemId, enabled }) =>
      trpc.member.get.useQuery(
        { systemId, memberId: id as never },
        { enabled },
      ) as DataQuery<RawEntity>,
  });
}

function useRemoteOnlyGetWithOverride(id: string, systemId: SystemId) {
  return useRemoteOnlyQuery<RawEntity>({
    systemIdOverride: { systemId },
    useRemote: ({ systemId: resolvedId, enabled }) =>
      trpc.member.get.useQuery(
        { systemId: resolvedId, memberId: id as never },
        { enabled },
      ) as DataQuery<RawEntity>,
  });
}

describe("useRemoteOnlyQuery", () => {
  it("resolves systemId from context", async () => {
    fixtures.set("member.get", { name: "Remote" });
    const { result } = renderHookWithProviders(() => useRemoteOnlyGet("r-1"));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data?.name).toBe("Remote");
  });

  it("respects systemIdOverride", async () => {
    fixtures.set("member.get", { name: "Override" });
    const overrideId = "sys-override" as SystemId;
    const { result } = renderHookWithProviders(() =>
      useRemoteOnlyGetWithOverride("r-2", overrideId),
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data?.name).toBe("Override");
  });

  it("passes enabled: true to consumer hook", () => {
    fixtures.set("member.get", { name: "Enabled" });
    const { result } = renderHookWithProviders(() => useRemoteOnlyGet("r-3"));

    // enabled: true means the query will fire, so fetchStatus should not be "idle"
    expect(result.current.fetchStatus).not.toBe("idle");
  });
});

// ── Table name validation ─────────────────────────────────────────────
describe("table name validation", () => {
  it("rejects table names with SQL injection characters", () => {
    function useBadTable() {
      return useOfflineFirstQuery<RawEntity, RawEntity>({
        queryKey: ["bad"],
        table: '"; DROP TABLE users --',
        entityId: "x",
        rowTransform: (row) => ({ name: String(row["name"]) }),
        useRemote: ({ systemId, enabled }) =>
          trpc.member.get.useQuery(
            { systemId, memberId: "x" as never },
            { enabled },
          ) as DataQuery<RawEntity>,
      });
    }

    expect(() => renderHookWithProviders(() => useBadTable())).toThrow("Invalid table name");
  });

  it("rejects invalid table names in useOfflineFirstInfiniteQuery", () => {
    function useBadInfiniteTable() {
      return useOfflineFirstInfiniteQuery<RawEntity, RawEntity>({
        queryKey: ["bad-infinite"],
        table: "'; DROP--",
        rowTransform: (row) => ({ name: String(row["name"]) }),
        useRemote: ({ enabled }) =>
          trpc.member.list.useInfiniteQuery(
            { systemId: "sys-test" as never },
            { enabled, getNextPageParam: () => null },
          ) as never,
      });
    }
    expect(() => renderHookWithProviders(() => useBadInfiniteTable())).toThrow(
      "Invalid table name",
    );
  });

  it("accepts valid table names with underscores", () => {
    fixtures.set("member.get", { name: "OK" });

    expect(() =>
      renderHookWithProviders(() =>
        useOfflineFirstQuery<RawEntity, RawEntity>({
          queryKey: ["good"],
          table: "valid_table_name",
          entityId: "x",
          rowTransform: (row) => ({ name: String(row["name"]) }),
          useRemote: ({ systemId, enabled }) =>
            trpc.member.get.useQuery(
              { systemId, memberId: "x" as never },
              { enabled },
            ) as DataQuery<RawEntity>,
        }),
      ),
    ).not.toThrow();
  });
});
