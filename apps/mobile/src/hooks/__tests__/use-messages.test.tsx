// @vitest-environment happy-dom
import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { encryptMessageInput } from "@pluralscape/data/transforms/message";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { TEST_MASTER_KEY, TEST_SYSTEM_ID } from "./helpers/test-crypto.js";

import type { MessageRaw } from "@pluralscape/data/transforms/message";
import type { ChannelId, MemberId, MessageId, UnixMillis } from "@pluralscape/types";

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

const mockUtils = {
  message: {
    get: { invalidate: vi.fn() },
    list: { invalidate: vi.fn() },
  },
};

vi.mock("@pluralscape/api-client/trpc", () => ({
  trpc: {
    message: {
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

// ── Tests ────────────────────────────────────────────────────────────
describe("useMessage", () => {
  it("enables when masterKey is present", () => {
    useMessage(CHANNEL_ID, "msg-1" as MessageId);
    expect(lastQueryOpts["enabled"]).toBe(true);
  });

  it("disables when masterKey is null", () => {
    vi.mocked(useMasterKey).mockReturnValueOnce(null);
    useMessage(CHANNEL_ID, "msg-1" as MessageId);
    expect(lastQueryOpts["enabled"]).toBe(false);
  });

  it("select decrypts raw message correctly", () => {
    useMessage(CHANNEL_ID, "msg-1" as MessageId);
    const select = lastQueryOpts["select"] as (raw: MessageRaw) => unknown;
    const raw = makeRawMessage("msg-1");
    const result = select(raw) as Record<string, unknown>;
    expect(result["content"]).toBe("hello");
    expect(result["senderId"]).toBe("m-1");
    expect(result["attachments"]).toEqual([]);
    expect(result["mentions"]).toEqual([]);
    expect(result["archived"]).toBe(false);
  });
});

describe("useMessagesList", () => {
  it("select decrypts each page item", () => {
    useMessagesList(CHANNEL_ID);
    const select = lastInfiniteOpts["select"] as (data: unknown) => unknown;
    const raw1 = makeRawMessage("msg-1");
    const raw2 = makeRawMessage("msg-2");
    const infiniteData = {
      pages: [{ data: [raw1, raw2], nextCursor: null }],
      pageParams: [undefined],
    };
    const result = select(infiniteData) as {
      pages: [{ data: [Record<string, unknown>, Record<string, unknown>] }];
    };
    expect(result.pages[0].data).toHaveLength(2);
    expect(result.pages[0].data[0]["content"]).toBe("hello");
    expect(result.pages[0].data[1]["content"]).toBe("hello");
  });
});

describe("useCreateMessage", () => {
  it("invalidates list on success", () => {
    mockUtils.message.list.invalidate.mockClear();
    useCreateMessage();
    const onSuccess = lastCreateMutationOpts["onSuccess"] as (
      data: unknown,
      variables: { channelId: string },
    ) => void;
    onSuccess(undefined, { channelId: CHANNEL_ID });
    expect(mockUtils.message.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      channelId: CHANNEL_ID,
    });
  });
});

describe("useUpdateMessage", () => {
  it("invalidates get and list on success", () => {
    mockUtils.message.get.invalidate.mockClear();
    mockUtils.message.list.invalidate.mockClear();
    useUpdateMessage();
    const onSuccess = lastUpdateMutationOpts["onSuccess"] as (
      data: unknown,
      variables: { channelId: string; messageId: string },
    ) => void;
    onSuccess(undefined, { channelId: CHANNEL_ID, messageId: "msg-1" });
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

describe("useArchiveMessage", () => {
  it("invalidates get and list on success", () => {
    mockUtils.message.get.invalidate.mockClear();
    mockUtils.message.list.invalidate.mockClear();
    useArchiveMessage();
    const onSuccess = lastArchiveMutationOpts["onSuccess"] as (
      data: unknown,
      variables: { channelId: string; messageId: string },
    ) => void;
    onSuccess(undefined, { channelId: CHANNEL_ID, messageId: "msg-2" });
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

describe("useRestoreMessage", () => {
  it("invalidates get and list on success", () => {
    mockUtils.message.get.invalidate.mockClear();
    mockUtils.message.list.invalidate.mockClear();
    useRestoreMessage();
    const onSuccess = lastRestoreMutationOpts["onSuccess"] as (
      data: unknown,
      variables: { channelId: string; messageId: string },
    ) => void;
    onSuccess(undefined, { channelId: CHANNEL_ID, messageId: "msg-3" });
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

describe("useDeleteMessage", () => {
  it("invalidates get and list on success", () => {
    mockUtils.message.get.invalidate.mockClear();
    mockUtils.message.list.invalidate.mockClear();
    useDeleteMessage();
    const onSuccess = lastDeleteMutationOpts["onSuccess"] as (
      data: unknown,
      variables: { channelId: string; messageId: string },
    ) => void;
    onSuccess(undefined, { channelId: CHANNEL_ID, messageId: "msg-4" });
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
