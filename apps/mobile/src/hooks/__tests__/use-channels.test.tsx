// @vitest-environment happy-dom
import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { encryptChannelInput } from "@pluralscape/data/transforms/channel";
import { brandId } from "@pluralscape/types";
import { act, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  renderHookWithProviders,
  TEST_MASTER_KEY,
  TEST_SYSTEM_ID,
} from "./helpers/render-hook-with-providers.js";

import type { ChannelRaw } from "@pluralscape/data/transforms/channel";
import type { ChannelId, UnixMillis } from "@pluralscape/types";

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
  channel: {
    get: { invalidate: vi.fn() },
    list: { invalidate: vi.fn() },
  },
};

// ── tRPC mock backed by real React Query ─────────────────────────────
vi.mock("@pluralscape/api-client/trpc", async () => {
  const rq = await import("@tanstack/react-query");

  return {
    trpc: {
      channel: {
        get: {
          useQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
            rq.useQuery({
              queryKey: ["channel.get", input],
              queryFn: () => Promise.resolve(fixtures.get("channel.get")),
              enabled: opts.enabled as boolean | undefined,
              select: opts.select as ((d: unknown) => unknown) | undefined,
            }),
        },
        list: {
          useInfiniteQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
            rq.useInfiniteQuery({
              queryKey: ["channel.list", input],
              queryFn: () => Promise.resolve(fixtures.get("channel.list")),
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
  useChannel,
  useChannelsList,
  useCreateChannel,
  useUpdateChannel,
  useArchiveChannel,
  useRestoreChannel,
  useDeleteChannel,
} = await import("../use-channels.js");

// ── Fixtures ─────────────────────────────────────────────────────────
const NOW = 1_700_000_000_000 as UnixMillis;

function makeRawChannel(id: string): ChannelRaw {
  const encrypted = encryptChannelInput({ name: "general" }, TEST_MASTER_KEY);
  return {
    id: brandId<ChannelId>(id),
    systemId: TEST_SYSTEM_ID,
    type: "channel",
    parentId: null,
    sortOrder: 0,
    version: 1,
    archived: false,
    archivedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...encrypted,
  };
}

beforeEach(() => {
  fixtures.clear();
  vi.clearAllMocks();
});

// ── Query tests ─────────────────────────────────────────────────────
describe("useChannel", () => {
  it("returns decrypted channel data", async () => {
    fixtures.set("channel.get", makeRawChannel("ch-1"));
    const { result } = renderHookWithProviders(() => useChannel(brandId<ChannelId>("ch-1")));

    let data: Awaited<ReturnType<typeof useChannel>>["data"] | undefined;
    await waitFor(() => {
      data = result.current.data;
      expect(result.current.isSuccess).toBe(true);
    });
    expect(data?.name).toBe("general");
    expect(data?.archived).toBe(false);
  });

  it("does not fetch when masterKey is null", () => {
    const { result } = renderHookWithProviders(() => useChannel(brandId<ChannelId>("ch-1")), {
      masterKey: null,
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });

  it("select is stable across rerenders (useCallback memoization)", async () => {
    fixtures.set("channel.get", makeRawChannel("ch-1"));
    const { result, rerender } = renderHookWithProviders(() =>
      useChannel(brandId<ChannelId>("ch-1")),
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const ref1 = result.current.data;
    rerender();
    expect(result.current.data).toBe(ref1);
  });
});

describe("useChannelsList", () => {
  it("returns decrypted paginated channels", async () => {
    const raw1 = makeRawChannel("ch-1");
    const raw2 = makeRawChannel("ch-2");
    fixtures.set("channel.list", { data: [raw1, raw2], nextCursor: null });

    const { result } = renderHookWithProviders(() => useChannelsList());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const data = result.current.data;
    const pages = data && "pages" in data ? data.pages : [];
    const [firstPage] = pages;
    const [item0, item1] = firstPage?.data ?? [];
    expect(pages).toHaveLength(1);
    expect(firstPage?.data).toHaveLength(2);
    expect(item0?.name).toBe("general");
    expect(item1?.name).toBe("general");
  });

  it("does not fetch when masterKey is null", () => {
    const { result } = renderHookWithProviders(() => useChannelsList(), { masterKey: null });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("select is stable across rerenders", async () => {
    fixtures.set("channel.list", { data: [makeRawChannel("ch-1")], nextCursor: null });
    const { result, rerender } = renderHookWithProviders(() => useChannelsList());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const ref1 = result.current.data;
    rerender();
    expect(result.current.data).toBe(ref1);
  });
});

// ── Mutation tests ──────────────────────────────────────────────────
describe("useCreateChannel", () => {
  it("invalidates list on success", async () => {
    const { result } = renderHookWithProviders(() => useCreateChannel());

    await act(() => result.current.mutateAsync({} as never));

    await waitFor(() => {
      expect(mockUtils.channel.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useUpdateChannel", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useUpdateChannel());

    await act(() => result.current.mutateAsync({ channelId: "ch-1" } as never));

    await waitFor(() => {
      expect(mockUtils.channel.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        channelId: "ch-1",
      });
      expect(mockUtils.channel.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useArchiveChannel", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useArchiveChannel());

    await act(() => result.current.mutateAsync({ channelId: "ch-2" } as never));

    await waitFor(() => {
      expect(mockUtils.channel.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        channelId: "ch-2",
      });
      expect(mockUtils.channel.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useRestoreChannel", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useRestoreChannel());

    await act(() => result.current.mutateAsync({ channelId: "ch-3" } as never));

    await waitFor(() => {
      expect(mockUtils.channel.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        channelId: "ch-3",
      });
      expect(mockUtils.channel.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useDeleteChannel", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useDeleteChannel());

    await act(() => result.current.mutateAsync({ channelId: "ch-4" } as never));

    await waitFor(() => {
      expect(mockUtils.channel.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        channelId: "ch-4",
      });
      expect(mockUtils.channel.list.invalidate).toHaveBeenCalledWith({
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

const LOCAL_CHANNEL_ROW: Record<string, unknown> = {
  id: "ch-local-1",
  system_id: TEST_SYSTEM_ID,
  name: "general",
  type: "channel",
  parent_id: null,
  sort_order: 0,
  archived: 0,
  created_at: 1_700_000_000_000,
  updated_at: 1_700_000_000_000,
};

describe("useChannel (local source)", () => {
  it("returns transformed local row data", async () => {
    const localDb = createMockLocalDb([LOCAL_CHANNEL_ROW]);
    const { result } = renderHookWithProviders(() => useChannel(brandId<ChannelId>("ch-local-1")), {
      querySource: "local",
      localDb,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(localDb.queryOne).toHaveBeenCalledWith(expect.stringContaining("own_channels"), [
      "ch-local-1",
    ]);
    expect(result.current.data).toMatchObject({
      id: "ch-local-1",
      name: "general",
      type: "channel",
      archived: false,
    });
  });

  it("does not call tRPC in local mode", async () => {
    const localDb = createMockLocalDb([LOCAL_CHANNEL_ROW]);
    const { result } = renderHookWithProviders(() => useChannel(brandId<ChannelId>("ch-local-1")), {
      querySource: "local",
      localDb,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.name).toBe("general");
  });
});

describe("useChannelsList (local source)", () => {
  it("returns flat array of transformed rows", async () => {
    const row2 = { ...LOCAL_CHANNEL_ROW, id: "ch-local-2", name: "announcements" };
    const localDb = createMockLocalDb([LOCAL_CHANNEL_ROW, row2]);
    const { result } = renderHookWithProviders(() => useChannelsList(), {
      querySource: "local",
      localDb,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(localDb.queryAll).toHaveBeenCalledWith(
      expect.stringContaining("own_channels"),
      expect.arrayContaining([TEST_SYSTEM_ID]),
    );

    const data = result.current.data;
    const pages = data && "pages" in data ? data.pages : [];
    expect(pages).toHaveLength(1);
    const items = pages[0] && "data" in pages[0] ? pages[0].data : [];
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ name: "general" });
    expect(items[1]).toMatchObject({ name: "announcements" });
  });

  it("does not require masterKey in local mode", async () => {
    const localDb = createMockLocalDb([LOCAL_CHANNEL_ROW]);
    const { result } = renderHookWithProviders(() => useChannelsList(), {
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
