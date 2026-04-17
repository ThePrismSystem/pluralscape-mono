// @vitest-environment happy-dom
import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { encryptBoardMessageInput } from "@pluralscape/data/transforms/board-message";
import { brandId } from "@pluralscape/types";
import { act, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  renderHookWithProviders,
  TEST_MASTER_KEY,
  TEST_SYSTEM_ID,
} from "./helpers/render-hook-with-providers.js";

import type { BoardMessageRaw } from "@pluralscape/data/transforms/board-message";
import type { BoardMessageId, MemberId, UnixMillis } from "@pluralscape/types";

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
  boardMessage: {
    get: { invalidate: vi.fn() },
    list: { invalidate: vi.fn() },
  },
};

// ── tRPC mock backed by real React Query ─────────────────────────────
vi.mock("@pluralscape/api-client/trpc", async () => {
  const rq = await import("@tanstack/react-query");

  return {
    trpc: {
      boardMessage: {
        get: {
          useQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
            rq.useQuery({
              queryKey: ["boardMessage.get", input],
              queryFn: () => Promise.resolve(fixtures.get("boardMessage.get")),
              enabled: opts.enabled as boolean | undefined,
              select: opts.select as ((d: unknown) => unknown) | undefined,
            }),
        },
        list: {
          useInfiniteQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
            rq.useInfiniteQuery({
              queryKey: ["boardMessage.list", input],
              queryFn: () => Promise.resolve(fixtures.get("boardMessage.list")),
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
        pin: {
          useMutation: (opts: Record<string, unknown> = {}) =>
            rq.useMutation({
              mutationFn: () => Promise.resolve({}),
              onSuccess: opts.onSuccess as
                | ((data: unknown, variables: unknown) => void)
                | undefined,
            }),
        },
        unpin: {
          useMutation: (opts: Record<string, unknown> = {}) =>
            rq.useMutation({
              mutationFn: () => Promise.resolve({}),
              onSuccess: opts.onSuccess as
                | ((data: unknown, variables: unknown) => void)
                | undefined,
            }),
        },
        reorder: {
          useMutation: (opts: Record<string, unknown> = {}) =>
            rq.useMutation({
              mutationFn: () => Promise.resolve({}),
              onSuccess: opts.onSuccess as (() => void) | undefined,
            }),
        },
      },
      useUtils: () => mockUtils,
    },
  };
});

// Must import AFTER vi.mock
const {
  useBoardMessage,
  useBoardMessagesList,
  useCreateBoardMessage,
  useUpdateBoardMessage,
  useArchiveBoardMessage,
  useRestoreBoardMessage,
  useDeleteBoardMessage,
  usePinBoardMessage,
  useUnpinBoardMessage,
  useReorderBoardMessages,
} = await import("../use-board-messages.js");

// ── Fixtures ─────────────────────────────────────────────────────────
const NOW = 1_700_000_000_000 as UnixMillis;

function makeRawBoardMessage(id: string): BoardMessageRaw {
  const encrypted = encryptBoardMessageInput(
    { content: "Board post", senderId: brandId<MemberId>("m-1") },
    TEST_MASTER_KEY,
  );
  return {
    id: brandId<BoardMessageId>(id),
    systemId: TEST_SYSTEM_ID,
    pinned: false,
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
describe("useBoardMessage", () => {
  it("returns decrypted board message data", async () => {
    fixtures.set("boardMessage.get", makeRawBoardMessage("bm-1"));
    const { result } = renderHookWithProviders(() =>
      useBoardMessage(brandId<BoardMessageId>("bm-1")),
    );

    let data: Awaited<ReturnType<typeof useBoardMessage>>["data"] | undefined;
    await waitFor(() => {
      data = result.current.data;
      expect(result.current.isSuccess).toBe(true);
    });
    expect(data?.content).toBe("Board post");
    expect(data?.pinned).toBe(false);
    expect(data?.archived).toBe(false);
  });

  it("does not fetch when masterKey is null", () => {
    const { result } = renderHookWithProviders(
      () => useBoardMessage(brandId<BoardMessageId>("bm-1")),
      {
        masterKey: null,
      },
    );
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });

  it("select is stable across rerenders (useCallback memoization)", async () => {
    fixtures.set("boardMessage.get", makeRawBoardMessage("bm-1"));
    const { result, rerender } = renderHookWithProviders(() =>
      useBoardMessage(brandId<BoardMessageId>("bm-1")),
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const ref1 = result.current.data;
    rerender();
    expect(result.current.data).toBe(ref1);
  });
});

describe("useBoardMessagesList", () => {
  it("returns decrypted paginated board messages", async () => {
    const raw1 = makeRawBoardMessage("bm-1");
    const raw2 = makeRawBoardMessage("bm-2");
    fixtures.set("boardMessage.list", { data: [raw1, raw2], nextCursor: null });

    const { result } = renderHookWithProviders(() => useBoardMessagesList());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const data = result.current.data;
    const pages = data && "pages" in data ? data.pages : [];
    const [firstPage] = pages;
    const [item0, item1] = firstPage?.data ?? [];
    expect(pages).toHaveLength(1);
    expect(firstPage?.data).toHaveLength(2);
    expect(item0?.content).toBe("Board post");
    expect(item1?.content).toBe("Board post");
  });

  it("does not fetch when masterKey is null", () => {
    const { result } = renderHookWithProviders(() => useBoardMessagesList(), {
      masterKey: null,
    });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("select is stable across rerenders", async () => {
    fixtures.set("boardMessage.list", {
      data: [makeRawBoardMessage("bm-1")],
      nextCursor: null,
    });
    const { result, rerender } = renderHookWithProviders(() => useBoardMessagesList());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const ref1 = result.current.data;
    rerender();
    expect(result.current.data).toBe(ref1);
  });
});

// ── Mutation tests ──────────────────────────────────────────────────
describe("useCreateBoardMessage", () => {
  it("invalidates list on success", async () => {
    const { result } = renderHookWithProviders(() => useCreateBoardMessage());

    await act(() => result.current.mutateAsync({} as never));

    await waitFor(() => {
      expect(mockUtils.boardMessage.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useUpdateBoardMessage", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useUpdateBoardMessage());

    await act(() => result.current.mutateAsync({ boardMessageId: "bm-1" } as never));

    await waitFor(() => {
      expect(mockUtils.boardMessage.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        boardMessageId: "bm-1",
      });
      expect(mockUtils.boardMessage.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useArchiveBoardMessage", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useArchiveBoardMessage());

    await act(() => result.current.mutateAsync({ boardMessageId: "bm-2" } as never));

    await waitFor(() => {
      expect(mockUtils.boardMessage.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        boardMessageId: "bm-2",
      });
      expect(mockUtils.boardMessage.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useRestoreBoardMessage", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useRestoreBoardMessage());

    await act(() => result.current.mutateAsync({ boardMessageId: "bm-3" } as never));

    await waitFor(() => {
      expect(mockUtils.boardMessage.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        boardMessageId: "bm-3",
      });
      expect(mockUtils.boardMessage.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useDeleteBoardMessage", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useDeleteBoardMessage());

    await act(() => result.current.mutateAsync({ boardMessageId: "bm-4" } as never));

    await waitFor(() => {
      expect(mockUtils.boardMessage.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        boardMessageId: "bm-4",
      });
      expect(mockUtils.boardMessage.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("usePinBoardMessage", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => usePinBoardMessage());

    await act(() => result.current.mutateAsync({ boardMessageId: "bm-5" } as never));

    await waitFor(() => {
      expect(mockUtils.boardMessage.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        boardMessageId: "bm-5",
      });
      expect(mockUtils.boardMessage.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useUnpinBoardMessage", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useUnpinBoardMessage());

    await act(() => result.current.mutateAsync({ boardMessageId: "bm-6" } as never));

    await waitFor(() => {
      expect(mockUtils.boardMessage.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        boardMessageId: "bm-6",
      });
      expect(mockUtils.boardMessage.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useReorderBoardMessages", () => {
  it("invalidates list on success", async () => {
    const { result } = renderHookWithProviders(() => useReorderBoardMessages());

    await act(() => result.current.mutateAsync({} as never));

    await waitFor(() => {
      expect(mockUtils.boardMessage.list.invalidate).toHaveBeenCalledWith({
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

const LOCAL_BOARD_MESSAGE_ROW: Record<string, unknown> = {
  id: "bm-local-1",
  system_id: TEST_SYSTEM_ID,
  sender_id: "m-1",
  content: "Board message content",
  pinned: 0,
  sort_order: 0,
  archived: 0,
  created_at: 1_700_000_000_000,
  updated_at: 1_700_000_000_000,
};

describe("useBoardMessage (local source)", () => {
  it("returns transformed local row data", async () => {
    const localDb = createMockLocalDb([LOCAL_BOARD_MESSAGE_ROW]);
    const { result } = renderHookWithProviders(
      () => useBoardMessage(brandId<BoardMessageId>("bm-local-1")),
      { querySource: "local", localDb },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(localDb.queryOne).toHaveBeenCalledWith(expect.stringContaining("own_board_messages"), [
      "bm-local-1",
    ]);
    expect(result.current.data).toMatchObject({
      id: "bm-local-1",
      content: "Board message content",
      pinned: false,
      archived: false,
    });
  });

  it("does not call tRPC in local mode", async () => {
    const localDb = createMockLocalDb([LOCAL_BOARD_MESSAGE_ROW]);
    const { result } = renderHookWithProviders(
      () => useBoardMessage(brandId<BoardMessageId>("bm-local-1")),
      { querySource: "local", localDb },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.content).toBe("Board message content");
  });
});

describe("useBoardMessagesList (local source)", () => {
  it("returns flat array of transformed rows", async () => {
    const row2 = { ...LOCAL_BOARD_MESSAGE_ROW, id: "bm-local-2", content: "Second board msg" };
    const localDb = createMockLocalDb([LOCAL_BOARD_MESSAGE_ROW, row2]);
    const { result } = renderHookWithProviders(() => useBoardMessagesList(), {
      querySource: "local",
      localDb,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(localDb.queryAll).toHaveBeenCalledWith(
      expect.stringContaining("own_board_messages"),
      expect.arrayContaining([TEST_SYSTEM_ID]),
    );

    const data = result.current.data;
    const pages = data && "pages" in data ? data.pages : [];
    expect(pages).toHaveLength(1);
    const items = pages[0] && "data" in pages[0] ? pages[0].data : [];
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ content: "Board message content" });
    expect(items[1]).toMatchObject({ content: "Second board msg" });
  });

  it("does not require masterKey in local mode", async () => {
    const localDb = createMockLocalDb([LOCAL_BOARD_MESSAGE_ROW]);
    const { result } = renderHookWithProviders(() => useBoardMessagesList(), {
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
