// @vitest-environment happy-dom
import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { encryptBoardMessageInput } from "@pluralscape/data/transforms/board-message";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { TEST_MASTER_KEY, TEST_SYSTEM_ID } from "./helpers/test-crypto.js";

import type { BoardMessageRaw } from "@pluralscape/data/transforms/board-message";
import type { BoardMessageId, MemberId, UnixMillis } from "@pluralscape/types";

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
});

vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return { ...(actual as object), useCallback: (fn: unknown) => fn };
});

// ── Capture tRPC hook calls ──────────────────────────────────────────
type CapturedOpts = Record<string, unknown>;
let lastQueryOpts: CapturedOpts = {};
let lastInfiniteOpts: CapturedOpts = {};
let lastCreateMutationOpts: CapturedOpts = {};
let lastUpdateMutationOpts: CapturedOpts = {};
let lastArchiveMutationOpts: CapturedOpts = {};
let lastRestoreMutationOpts: CapturedOpts = {};
let lastDeleteMutationOpts: CapturedOpts = {};
let lastPinMutationOpts: CapturedOpts = {};
let lastUnpinMutationOpts: CapturedOpts = {};
let lastReorderMutationOpts: CapturedOpts = {};

const mockUtils = {
  boardMessage: {
    get: { invalidate: vi.fn() },
    list: { invalidate: vi.fn() },
  },
};

vi.mock("@pluralscape/api-client/trpc", () => ({
  trpc: {
    boardMessage: {
      get: {
        useQuery: (_input: unknown, opts: CapturedOpts) => {
          lastQueryOpts = opts;
          return { data: undefined, isLoading: true, status: "loading" };
        },
      },
      list: {
        useInfiniteQuery: (_input: unknown, opts: CapturedOpts) => {
          lastInfiniteOpts = opts;
          return { data: undefined, isLoading: true, status: "loading" };
        },
      },
      create: {
        useMutation: (opts: CapturedOpts) => {
          lastCreateMutationOpts = opts;
          return { mutate: vi.fn() };
        },
      },
      update: {
        useMutation: (opts: CapturedOpts) => {
          lastUpdateMutationOpts = opts;
          return { mutate: vi.fn() };
        },
      },
      archive: {
        useMutation: (opts: CapturedOpts) => {
          lastArchiveMutationOpts = opts;
          return { mutate: vi.fn() };
        },
      },
      restore: {
        useMutation: (opts: CapturedOpts) => {
          lastRestoreMutationOpts = opts;
          return { mutate: vi.fn() };
        },
      },
      delete: {
        useMutation: (opts: CapturedOpts) => {
          lastDeleteMutationOpts = opts;
          return { mutate: vi.fn() };
        },
      },
      pin: {
        useMutation: (opts: CapturedOpts) => {
          lastPinMutationOpts = opts;
          return { mutate: vi.fn() };
        },
      },
      unpin: {
        useMutation: (opts: CapturedOpts) => {
          lastUnpinMutationOpts = opts;
          return { mutate: vi.fn() };
        },
      },
      reorder: {
        useMutation: (opts: CapturedOpts) => {
          lastReorderMutationOpts = opts;
          return { mutate: vi.fn() };
        },
      },
    },
    useUtils: () => mockUtils,
  },
}));

vi.mock("../../providers/crypto-provider.js", () => ({
  useMasterKey: vi.fn(() => TEST_MASTER_KEY),
}));
vi.mock("../../providers/system-provider.js", () => ({
  useActiveSystemId: vi.fn(() => TEST_SYSTEM_ID),
}));

const { useMasterKey } = await import("../../providers/crypto-provider.js");
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
    { content: "Board post", senderId: "m-1" as MemberId },
    TEST_MASTER_KEY,
  );
  return {
    id: id as BoardMessageId,
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

// ── Tests ────────────────────────────────────────────────────────────
describe("useBoardMessage", () => {
  it("enables when masterKey is present", () => {
    useBoardMessage("bm-1" as BoardMessageId);
    expect(lastQueryOpts["enabled"]).toBe(true);
  });

  it("disables when masterKey is null", () => {
    vi.mocked(useMasterKey).mockReturnValueOnce(null);
    useBoardMessage("bm-1" as BoardMessageId);
    expect(lastQueryOpts["enabled"]).toBe(false);
  });

  it("select decrypts raw board message correctly", () => {
    useBoardMessage("bm-1" as BoardMessageId);
    const select = lastQueryOpts["select"] as (raw: BoardMessageRaw) => unknown;
    const raw = makeRawBoardMessage("bm-1");
    const result = select(raw) as Record<string, unknown>;
    expect(result["content"]).toBe("Board post");
    expect(result["senderId"]).toBe("m-1");
    expect(result["pinned"]).toBe(false);
    expect(result["archived"]).toBe(false);
  });
});

describe("useBoardMessagesList", () => {
  it("select decrypts each page item", () => {
    useBoardMessagesList();
    const select = lastInfiniteOpts["select"] as (data: unknown) => unknown;
    const raw1 = makeRawBoardMessage("bm-1");
    const raw2 = makeRawBoardMessage("bm-2");
    const infiniteData = {
      pages: [{ data: [raw1, raw2], nextCursor: null }],
      pageParams: [undefined],
    };
    const result = select(infiniteData) as {
      pages: [{ data: [Record<string, unknown>, Record<string, unknown>] }];
    };
    expect(result.pages[0].data).toHaveLength(2);
    expect(result.pages[0].data[0]["content"]).toBe("Board post");
    expect(result.pages[0].data[1]["content"]).toBe("Board post");
  });
});

describe("useCreateBoardMessage", () => {
  it("invalidates list on success", () => {
    mockUtils.boardMessage.list.invalidate.mockClear();
    useCreateBoardMessage();
    const onSuccess = lastCreateMutationOpts["onSuccess"] as () => void;
    onSuccess();
    expect(mockUtils.boardMessage.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });
});

describe("useUpdateBoardMessage", () => {
  it("invalidates get and list on success", () => {
    mockUtils.boardMessage.get.invalidate.mockClear();
    mockUtils.boardMessage.list.invalidate.mockClear();
    useUpdateBoardMessage();
    const onSuccess = lastUpdateMutationOpts["onSuccess"] as (
      data: unknown,
      variables: { boardMessageId: string },
    ) => void;
    onSuccess(undefined, { boardMessageId: "bm-1" });
    expect(mockUtils.boardMessage.get.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      boardMessageId: "bm-1",
    });
    expect(mockUtils.boardMessage.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });
});

describe("useArchiveBoardMessage", () => {
  it("invalidates get and list on success", () => {
    mockUtils.boardMessage.get.invalidate.mockClear();
    mockUtils.boardMessage.list.invalidate.mockClear();
    useArchiveBoardMessage();
    const onSuccess = lastArchiveMutationOpts["onSuccess"] as (
      data: unknown,
      variables: { boardMessageId: string },
    ) => void;
    onSuccess(undefined, { boardMessageId: "bm-2" });
    expect(mockUtils.boardMessage.get.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      boardMessageId: "bm-2",
    });
    expect(mockUtils.boardMessage.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });
});

describe("useRestoreBoardMessage", () => {
  it("invalidates get and list on success", () => {
    mockUtils.boardMessage.get.invalidate.mockClear();
    mockUtils.boardMessage.list.invalidate.mockClear();
    useRestoreBoardMessage();
    const onSuccess = lastRestoreMutationOpts["onSuccess"] as (
      data: unknown,
      variables: { boardMessageId: string },
    ) => void;
    onSuccess(undefined, { boardMessageId: "bm-3" });
    expect(mockUtils.boardMessage.get.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      boardMessageId: "bm-3",
    });
    expect(mockUtils.boardMessage.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });
});

describe("useDeleteBoardMessage", () => {
  it("invalidates get and list on success", () => {
    mockUtils.boardMessage.get.invalidate.mockClear();
    mockUtils.boardMessage.list.invalidate.mockClear();
    useDeleteBoardMessage();
    const onSuccess = lastDeleteMutationOpts["onSuccess"] as (
      data: unknown,
      variables: { boardMessageId: string },
    ) => void;
    onSuccess(undefined, { boardMessageId: "bm-4" });
    expect(mockUtils.boardMessage.get.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      boardMessageId: "bm-4",
    });
    expect(mockUtils.boardMessage.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });
});

describe("usePinBoardMessage", () => {
  it("invalidates get and list on success", () => {
    mockUtils.boardMessage.get.invalidate.mockClear();
    mockUtils.boardMessage.list.invalidate.mockClear();
    usePinBoardMessage();
    const onSuccess = lastPinMutationOpts["onSuccess"] as (
      data: unknown,
      variables: { boardMessageId: string },
    ) => void;
    onSuccess(undefined, { boardMessageId: "bm-5" });
    expect(mockUtils.boardMessage.get.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      boardMessageId: "bm-5",
    });
    expect(mockUtils.boardMessage.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });
});

describe("useUnpinBoardMessage", () => {
  it("invalidates get and list on success", () => {
    mockUtils.boardMessage.get.invalidate.mockClear();
    mockUtils.boardMessage.list.invalidate.mockClear();
    useUnpinBoardMessage();
    const onSuccess = lastUnpinMutationOpts["onSuccess"] as (
      data: unknown,
      variables: { boardMessageId: string },
    ) => void;
    onSuccess(undefined, { boardMessageId: "bm-6" });
    expect(mockUtils.boardMessage.get.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      boardMessageId: "bm-6",
    });
    expect(mockUtils.boardMessage.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });
});

describe("useReorderBoardMessages", () => {
  it("invalidates list on success", () => {
    mockUtils.boardMessage.list.invalidate.mockClear();
    useReorderBoardMessages();
    const onSuccess = lastReorderMutationOpts["onSuccess"] as () => void;
    onSuccess();
    expect(mockUtils.boardMessage.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });
});
