// @vitest-environment happy-dom
import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { encryptMessageInput } from "@pluralscape/data/transforms/message";
import { act, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  renderHookWithProviders,
  TEST_MASTER_KEY,
  TEST_SYSTEM_ID,
} from "./helpers/render-hook-with-providers.js";

import type { MessageRaw } from "@pluralscape/data/transforms/message";
import type { ChannelId, MemberId, MessageId, UnixMillis } from "@pluralscape/types";

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
  message: {
    get: { invalidate: vi.fn() },
    list: { invalidate: vi.fn() },
  },
};

// ── tRPC mock backed by real React Query ─────────────────────────────
vi.mock("@pluralscape/api-client/trpc", async () => {
  const rq = await import("@tanstack/react-query");

  return {
    trpc: {
      message: {
        get: {
          useQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
            rq.useQuery({
              queryKey: ["message.get", input],
              queryFn: () => Promise.resolve(fixtures.get("message.get")),
              enabled: opts.enabled as boolean | undefined,
              select: opts.select as ((d: unknown) => unknown) | undefined,
            }),
        },
        list: {
          useInfiniteQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
            rq.useInfiniteQuery({
              queryKey: ["message.list", input],
              queryFn: () => Promise.resolve(fixtures.get("message.list")),
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
              onSuccess: opts.onSuccess as
                | ((data: unknown, variables: unknown) => void)
                | undefined,
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
  useMessage,
  useMessagesList,
  useCreateMessage,
  useUpdateMessage,
  useArchiveMessage,
  useRestoreMessage,
  useDeleteMessage,
} = await import("../use-messages.js");

// ── Fixtures ─────────────────────────────────────────────────────────
const NOW = 1_700_000_000_000 as UnixMillis;
const CHANNEL_ID = "ch-1" as ChannelId;

function makeRawMessage(id: string): MessageRaw {
  const encrypted = encryptMessageInput(
    {
      content: "hello",
      attachments: [],
      mentions: [],
      senderId: "m-1" as MemberId,
    },
    TEST_MASTER_KEY,
  );
  return {
    id: id as MessageId,
    channelId: CHANNEL_ID,
    systemId: TEST_SYSTEM_ID,
    replyToId: null,
    timestamp: NOW,
    editedAt: null,
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
describe("useMessage", () => {
  it("returns decrypted message data", async () => {
    fixtures.set("message.get", makeRawMessage("msg-1"));
    const { result } = renderHookWithProviders(() => useMessage(CHANNEL_ID, "msg-1" as MessageId));

    let data: Awaited<ReturnType<typeof useMessage>>["data"] | undefined;
    await waitFor(() => {
      data = result.current.data;
      expect(data).toBeDefined();
    });
    expect(data?.content).toBe("hello");
    expect(data?.archived).toBe(false);
  });

  it("does not fetch when masterKey is null", () => {
    const { result } = renderHookWithProviders(() => useMessage(CHANNEL_ID, "msg-1" as MessageId), {
      masterKey: null,
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });

  it("select is stable across rerenders (useCallback memoization)", async () => {
    fixtures.set("message.get", makeRawMessage("msg-1"));
    const { result, rerender } = renderHookWithProviders(() =>
      useMessage(CHANNEL_ID, "msg-1" as MessageId),
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const ref1 = result.current.data;
    rerender();
    expect(result.current.data).toBe(ref1);
  });
});

describe("useMessagesList", () => {
  it("returns decrypted paginated messages", async () => {
    const raw1 = makeRawMessage("msg-1");
    const raw2 = makeRawMessage("msg-2");
    fixtures.set("message.list", { data: [raw1, raw2], nextCursor: null });

    const { result } = renderHookWithProviders(() => useMessagesList(CHANNEL_ID));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const pages = result.current.data?.pages ?? [];
    const [firstPage] = pages;
    const [item0, item1] = firstPage?.data ?? [];
    expect(pages).toHaveLength(1);
    expect(firstPage?.data).toHaveLength(2);
    expect(item0?.content).toBe("hello");
    expect(item1?.content).toBe("hello");
  });

  it("does not fetch when masterKey is null", () => {
    const { result } = renderHookWithProviders(() => useMessagesList(CHANNEL_ID), {
      masterKey: null,
    });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("select is stable across rerenders", async () => {
    fixtures.set("message.list", { data: [makeRawMessage("msg-1")], nextCursor: null });
    const { result, rerender } = renderHookWithProviders(() => useMessagesList(CHANNEL_ID));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const ref1 = result.current.data;
    rerender();
    expect(result.current.data).toBe(ref1);
  });
});

// ── Mutation tests ──────────────────────────────────────────────────
describe("useCreateMessage", () => {
  it("invalidates list on success", async () => {
    const { result } = renderHookWithProviders(() => useCreateMessage());

    await act(() => result.current.mutateAsync({ channelId: CHANNEL_ID } as never));

    await waitFor(() => {
      expect(mockUtils.message.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        channelId: CHANNEL_ID,
      });
    });
  });
});

describe("useUpdateMessage", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useUpdateMessage());

    await act(() =>
      result.current.mutateAsync({ channelId: CHANNEL_ID, messageId: "msg-1" } as never),
    );

    await waitFor(() => {
      expect(mockUtils.message.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        channelId: CHANNEL_ID,
        messageId: "msg-1",
      });
      expect(mockUtils.message.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        channelId: CHANNEL_ID,
      });
    });
  });
});

describe("useArchiveMessage", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useArchiveMessage());

    await act(() =>
      result.current.mutateAsync({ channelId: CHANNEL_ID, messageId: "msg-2" } as never),
    );

    await waitFor(() => {
      expect(mockUtils.message.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        channelId: CHANNEL_ID,
        messageId: "msg-2",
      });
      expect(mockUtils.message.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        channelId: CHANNEL_ID,
      });
    });
  });
});

describe("useRestoreMessage", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useRestoreMessage());

    await act(() =>
      result.current.mutateAsync({ channelId: CHANNEL_ID, messageId: "msg-3" } as never),
    );

    await waitFor(() => {
      expect(mockUtils.message.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        channelId: CHANNEL_ID,
        messageId: "msg-3",
      });
      expect(mockUtils.message.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        channelId: CHANNEL_ID,
      });
    });
  });
});

describe("useDeleteMessage", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useDeleteMessage());

    await act(() =>
      result.current.mutateAsync({ channelId: CHANNEL_ID, messageId: "msg-4" } as never),
    );

    await waitFor(() => {
      expect(mockUtils.message.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        channelId: CHANNEL_ID,
        messageId: "msg-4",
      });
      expect(mockUtils.message.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        channelId: CHANNEL_ID,
      });
    });
  });
});
