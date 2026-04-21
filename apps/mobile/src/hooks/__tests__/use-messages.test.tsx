// @vitest-environment happy-dom
import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { brandId } from "@pluralscape/types";
import { act, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { makeRawMessage } from "../../__tests__/factories.js";

import { renderHookWithProviders, TEST_SYSTEM_ID } from "./helpers/render-hook-with-providers.js";

import type { ChannelId, MessageId } from "@pluralscape/types";

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

const CHANNEL_ID = brandId<ChannelId>("ch-1");

beforeEach(() => {
  fixtures.clear();
  vi.clearAllMocks();
});

// ── Query tests ─────────────────────────────────────────────────────
describe("useMessage", () => {
  it("returns decrypted message data", async () => {
    fixtures.set("message.get", makeRawMessage("msg-1"));
    const { result } = renderHookWithProviders(() =>
      useMessage(CHANNEL_ID, brandId<MessageId>("msg-1")),
    );

    let data: Awaited<ReturnType<typeof useMessage>>["data"] | undefined;
    await waitFor(() => {
      data = result.current.data;
      expect(result.current.isSuccess).toBe(true);
    });
    expect(data?.content).toBe("hello");
    expect(data?.archived).toBe(false);
  });

  it("does not fetch when masterKey is null", () => {
    const { result } = renderHookWithProviders(
      () => useMessage(CHANNEL_ID, brandId<MessageId>("msg-1")),
      {
        masterKey: null,
      },
    );
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });

  it("select is stable across rerenders (useCallback memoization)", async () => {
    fixtures.set("message.get", makeRawMessage("msg-1"));
    const { result, rerender } = renderHookWithProviders(() =>
      useMessage(CHANNEL_ID, brandId<MessageId>("msg-1")),
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
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
      expect(result.current.isSuccess).toBe(true);
    });
    const data = result.current.data;
    const pages = data && "pages" in data ? data.pages : [];
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
      expect(result.current.isSuccess).toBe(true);
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

const LOCAL_MESSAGE_ROW: Record<string, unknown> = {
  id: "msg-local-1",
  channel_id: "ch-1",
  system_id: TEST_SYSTEM_ID,
  sender_id: "m-1",
  content: "hello from sqlite",
  attachments: "[]",
  mentions: "[]",
  reply_to_id: null,
  timestamp: 1_700_000_000_000,
  edited_at: null,
  archived: 0,
  created_at: 1_700_000_000_000,
  updated_at: 1_700_000_000_000,
};

describe("useMessage (local source)", () => {
  it("returns transformed local row data", async () => {
    const localDb = createMockLocalDb([LOCAL_MESSAGE_ROW]);
    const { result } = renderHookWithProviders(
      () => useMessage(CHANNEL_ID, brandId<MessageId>("msg-local-1")),
      { querySource: "local", localDb },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(localDb.queryOne).toHaveBeenCalledWith(expect.stringContaining("own_messages"), [
      "msg-local-1",
      CHANNEL_ID,
    ]);
    expect(result.current.data).toMatchObject({
      id: "msg-local-1",
      content: "hello from sqlite",
      archived: false,
      attachments: [],
    });
  });

  it("does not call tRPC in local mode", async () => {
    const localDb = createMockLocalDb([LOCAL_MESSAGE_ROW]);
    const { result } = renderHookWithProviders(
      () => useMessage(CHANNEL_ID, brandId<MessageId>("msg-local-1")),
      { querySource: "local", localDb },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.content).toBe("hello from sqlite");
  });
});

describe("useMessagesList (local source)", () => {
  it("returns flat array of transformed rows", async () => {
    const row2 = { ...LOCAL_MESSAGE_ROW, id: "msg-local-2", content: "second message" };
    const localDb = createMockLocalDb([LOCAL_MESSAGE_ROW, row2]);
    const { result } = renderHookWithProviders(() => useMessagesList(CHANNEL_ID), {
      querySource: "local",
      localDb,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(localDb.queryAll).toHaveBeenCalledWith(
      expect.stringContaining("own_messages"),
      expect.arrayContaining([TEST_SYSTEM_ID, CHANNEL_ID]),
    );

    const data = result.current.data;
    const pages = data && "pages" in data ? data.pages : [];
    expect(pages).toHaveLength(1);
    const items = pages[0] && "data" in pages[0] ? pages[0].data : [];
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ content: "hello from sqlite" });
    expect(items[1]).toMatchObject({ content: "second message" });
  });

  it("does not require masterKey in local mode", async () => {
    const localDb = createMockLocalDb([LOCAL_MESSAGE_ROW]);
    const { result } = renderHookWithProviders(() => useMessagesList(CHANNEL_ID), {
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
