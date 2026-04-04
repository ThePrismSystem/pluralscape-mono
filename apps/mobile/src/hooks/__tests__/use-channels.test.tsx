// @vitest-environment happy-dom
import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { encryptChannelInput } from "@pluralscape/data/transforms/channel";
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
    id: id as ChannelId,
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
    const { result } = renderHookWithProviders(() => useChannel("ch-1" as ChannelId));

    let data: Awaited<ReturnType<typeof useChannel>>["data"] | undefined;
    await waitFor(() => {
      data = result.current.data;
      expect(data).toBeDefined();
    });
    expect(data?.name).toBe("general");
    expect(data?.archived).toBe(false);
  });

  it("does not fetch when masterKey is null", () => {
    const { result } = renderHookWithProviders(() => useChannel("ch-1" as ChannelId), {
      masterKey: null,
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });

  it("select is stable across rerenders (useCallback memoization)", async () => {
    fixtures.set("channel.get", makeRawChannel("ch-1"));
    const { result, rerender } = renderHookWithProviders(() => useChannel("ch-1" as ChannelId));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
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
      expect(result.current.data).toBeDefined();
    });
    const pages = result.current.data?.pages ?? [];
    expect(pages).toHaveLength(1);
    expect(pages[0].data).toHaveLength(2);
    expect(pages[0].data[0].name).toBe("general");
    expect(pages[0].data[1].name).toBe("general");
  });

  it("does not fetch when masterKey is null", () => {
    const { result } = renderHookWithProviders(() => useChannelsList(), { masterKey: null });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("select is stable across rerenders", async () => {
    fixtures.set("channel.list", { data: [makeRawChannel("ch-1")], nextCursor: null });
    const { result, rerender } = renderHookWithProviders(() => useChannelsList());

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
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
