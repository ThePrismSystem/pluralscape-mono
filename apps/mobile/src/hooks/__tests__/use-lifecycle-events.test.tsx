// @vitest-environment happy-dom
import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { brandId } from "@pluralscape/types";
import { act, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { makeRawLifecycleEvent } from "../../__tests__/factories/index.js";

import { renderHookWithProviders, TEST_SYSTEM_ID } from "./helpers/render-hook-with-providers.js";

import type { LifecycleEventId, LifecycleEventWire } from "@pluralscape/types";

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
  lifecycleEvent: {
    get: { invalidate: vi.fn() },
    list: { invalidate: vi.fn() },
  },
};

// ── tRPC mock backed by real React Query ─────────────────────────────
vi.mock("@pluralscape/api-client/trpc", async () => {
  const rq = await import("@tanstack/react-query");

  return {
    trpc: {
      lifecycleEvent: {
        get: {
          useQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
            rq.useQuery({
              queryKey: ["lifecycleEvent.get", input],
              queryFn: () => Promise.resolve(fixtures.get("lifecycleEvent.get")),
              enabled: opts.enabled as boolean | undefined,
              select: opts.select as ((d: unknown) => unknown) | undefined,
            }),
        },
        list: {
          useInfiniteQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
            rq.useInfiniteQuery({
              queryKey: ["lifecycleEvent.list", input],
              queryFn: () => Promise.resolve(fixtures.get("lifecycleEvent.list")),
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

// Must import AFTER vi.mock
const {
  useLifecycleEvent,
  useLifecycleEventsList,
  useCreateLifecycleEvent,
  useUpdateLifecycleEvent,
  useArchiveLifecycleEvent,
  useRestoreLifecycleEvent,
  useDeleteLifecycleEvent,
} = await import("../use-lifecycle-events.js");

function makeDiscoveryEvent(id: string, memberId: string): LifecycleEventWire {
  return makeRawLifecycleEvent(id, "discovery", { notes: null }, { memberIds: [memberId] });
}

beforeEach(() => {
  fixtures.clear();
  vi.clearAllMocks();
});

// ── Query tests ──────────────────────────────────────────────────────
describe("useLifecycleEvent", () => {
  it("decrypts a discovery event", async () => {
    fixtures.set("lifecycleEvent.get", makeDiscoveryEvent("evt-1", "mem-1"));
    const { result } = renderHookWithProviders(() =>
      useLifecycleEvent(brandId<LifecycleEventId>("evt-1")),
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const data = result.current.data;
    expect(data?.eventType).toBe("discovery");
    // Narrow away the local row type to access decrypted fields
    if (data && "memberId" in data && data.eventType === "discovery") {
      expect(data.memberId).toBe("mem-1");
    }
    expect(data?.archived).toBe(false);
  });

  it("does not fetch when masterKey is null", () => {
    const { result } = renderHookWithProviders(
      () => useLifecycleEvent(brandId<LifecycleEventId>("evt-1")),
      { masterKey: null },
    );
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });

  it("select is stable across rerenders (useCallback memoization)", async () => {
    fixtures.set("lifecycleEvent.get", makeDiscoveryEvent("evt-1", "mem-1"));
    const { result, rerender } = renderHookWithProviders(() =>
      useLifecycleEvent(brandId<LifecycleEventId>("evt-1")),
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const ref1 = result.current.data;
    rerender();
    expect(result.current.data).toBe(ref1);
  });
});

describe("useLifecycleEventsList", () => {
  it("returns decrypted paginated events", async () => {
    const raw1 = makeDiscoveryEvent("evt-1", "mem-1");
    const raw2 = makeDiscoveryEvent("evt-2", "mem-2");
    fixtures.set("lifecycleEvent.list", { data: [raw1, raw2], nextCursor: null });

    const { result } = renderHookWithProviders(() => useLifecycleEventsList());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const listData = result.current.data;
    const pages = listData && "pages" in listData ? listData.pages : [];
    const [firstPage] = pages;
    const [item0, item1] = firstPage?.data ?? [];
    expect(pages).toHaveLength(1);
    expect(firstPage?.data).toHaveLength(2);
    expect(item0?.eventType).toBe("discovery");
    expect(item1?.eventType).toBe("discovery");
    if (item0 && "memberId" in item0 && item0.eventType === "discovery") {
      expect(item0.memberId).toBe("mem-1");
    }
    if (item1 && "memberId" in item1 && item1.eventType === "discovery") {
      expect(item1.memberId).toBe("mem-2");
    }
  });

  it("does not fetch when masterKey is null", () => {
    const { result } = renderHookWithProviders(() => useLifecycleEventsList(), {
      masterKey: null,
    });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("select is stable across rerenders", async () => {
    fixtures.set("lifecycleEvent.list", {
      data: [makeDiscoveryEvent("evt-1", "mem-1")],
      nextCursor: null,
    });
    const { result, rerender } = renderHookWithProviders(() => useLifecycleEventsList());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const ref1 = result.current.data;
    rerender();
    expect(result.current.data).toBe(ref1);
  });

  it("handles empty page", async () => {
    fixtures.set("lifecycleEvent.list", { data: [], nextCursor: null });
    const { result } = renderHookWithProviders(() => useLifecycleEventsList());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const listData = result.current.data;
    const pages = listData && "pages" in listData ? listData.pages : [];
    const [firstPage] = pages;
    expect(firstPage?.data).toHaveLength(0);
  });
});

// ── Mutation tests ───────────────────────────────────────────────────
describe("useCreateLifecycleEvent", () => {
  it("invalidates list on success", async () => {
    const { result } = renderHookWithProviders(() => useCreateLifecycleEvent());

    await act(() => result.current.mutateAsync({} as never));

    await waitFor(() => {
      expect(mockUtils.lifecycleEvent.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useUpdateLifecycleEvent", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useUpdateLifecycleEvent());

    await act(() => result.current.mutateAsync({ eventId: "evt-1" } as never));

    await waitFor(() => {
      expect(mockUtils.lifecycleEvent.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        eventId: "evt-1",
      });
      expect(mockUtils.lifecycleEvent.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useArchiveLifecycleEvent", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useArchiveLifecycleEvent());

    await act(() => result.current.mutateAsync({ eventId: "evt-2" } as never));

    await waitFor(() => {
      expect(mockUtils.lifecycleEvent.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        eventId: "evt-2",
      });
      expect(mockUtils.lifecycleEvent.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useRestoreLifecycleEvent", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useRestoreLifecycleEvent());

    await act(() => result.current.mutateAsync({ eventId: "evt-3" } as never));

    await waitFor(() => {
      expect(mockUtils.lifecycleEvent.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        eventId: "evt-3",
      });
      expect(mockUtils.lifecycleEvent.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useDeleteLifecycleEvent", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useDeleteLifecycleEvent());

    await act(() => result.current.mutateAsync({ eventId: "evt-4" } as never));

    await waitFor(() => {
      expect(mockUtils.lifecycleEvent.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        eventId: "evt-4",
      });
      expect(mockUtils.lifecycleEvent.list.invalidate).toHaveBeenCalledWith({
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

const LOCAL_LIFECYCLE_EVENT_ROW: Record<string, unknown> = {
  id: "evt-local-1",
  system_id: TEST_SYSTEM_ID,
  event_type: "discovery",
  occurred_at: 1_700_000_000_000,
  recorded_at: 1_700_000_000_000,
  notes: "Some notes",
  payload: "{}",
  archived: 0,
};

describe("useLifecycleEvent (local source)", () => {
  it("returns transformed local row data", async () => {
    const localDb = createMockLocalDb([LOCAL_LIFECYCLE_EVENT_ROW]);
    const { result } = renderHookWithProviders(
      () => useLifecycleEvent(brandId<LifecycleEventId>("evt-local-1")),
      { querySource: "local", localDb },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(localDb.queryOne).toHaveBeenCalledWith(expect.stringContaining("lifecycle_events"), [
      "evt-local-1",
    ]);
    expect(result.current.data).toMatchObject({
      id: "evt-local-1",
      eventType: "discovery",
      notes: "Some notes",
    });
  });

  it("does not call tRPC in local mode", async () => {
    const localDb = createMockLocalDb([LOCAL_LIFECYCLE_EVENT_ROW]);
    const { result } = renderHookWithProviders(
      () => useLifecycleEvent(brandId<LifecycleEventId>("evt-local-1")),
      { querySource: "local", localDb },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toMatchObject({ id: "evt-local-1" });
  });
});

describe("useLifecycleEventsList (local source)", () => {
  it("returns flat array of transformed rows", async () => {
    const row2 = { ...LOCAL_LIFECYCLE_EVENT_ROW, id: "evt-local-2", event_type: "switch" };
    const localDb = createMockLocalDb([LOCAL_LIFECYCLE_EVENT_ROW, row2]);
    const { result } = renderHookWithProviders(() => useLifecycleEventsList(), {
      querySource: "local",
      localDb,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(localDb.queryAll).toHaveBeenCalledWith(
      expect.stringContaining("lifecycle_events"),
      expect.arrayContaining([TEST_SYSTEM_ID]),
    );

    const data = result.current.data;
    const pages = data && "pages" in data ? data.pages : [];
    expect(pages).toHaveLength(1);
    const items = pages[0] && "data" in pages[0] ? pages[0].data : [];
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ eventType: "discovery" });
    expect(items[1]).toMatchObject({ eventType: "switch" });
  });

  it("does not require masterKey in local mode", async () => {
    const localDb = createMockLocalDb([LOCAL_LIFECYCLE_EVENT_ROW]);
    const { result } = renderHookWithProviders(() => useLifecycleEventsList(), {
      querySource: "local",
      localDb,
      masterKey: null,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const data = result.current.data;
    const pages = data && "pages" in data ? data.pages : [];
    const items = pages[0] && "data" in pages[0] ? pages[0].data : [];
    expect(items).toHaveLength(1);
  });
});
