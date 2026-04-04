// @vitest-environment happy-dom
import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { encryptChannelInput } from "@pluralscape/data/transforms/channel";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { TEST_MASTER_KEY, TEST_SYSTEM_ID } from "./helpers/test-crypto.js";

import type { ChannelRaw } from "@pluralscape/data/transforms/channel";
import type { ChannelId, UnixMillis } from "@pluralscape/types";

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
  channel: {
    get: { invalidate: vi.fn() },
    list: { invalidate: vi.fn() },
  },
};

vi.mock("@pluralscape/api-client/trpc", () => ({
  trpc: {
    channel: {
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

// ── Tests ────────────────────────────────────────────────────────────
describe("useChannel", () => {
  it("enables when masterKey is present", () => {
    useChannel("ch-1" as ChannelId);
    expect(lastQueryOpts["enabled"]).toBe(true);
  });

  it("disables when masterKey is null", () => {
    vi.mocked(useMasterKey).mockReturnValueOnce(null);
    useChannel("ch-1" as ChannelId);
    expect(lastQueryOpts["enabled"]).toBe(false);
  });

  it("select decrypts raw channel correctly", () => {
    useChannel("ch-1" as ChannelId);
    const select = lastQueryOpts["select"] as (raw: ChannelRaw) => unknown;
    const raw = makeRawChannel("ch-1");
    const result = select(raw) as Record<string, unknown>;
    expect(result["name"]).toBe("general");
    expect(result["type"]).toBe("channel");
    expect(result["archived"]).toBe(false);
  });
});

describe("useChannelsList", () => {
  it("select decrypts each page item", () => {
    useChannelsList();
    const select = lastInfiniteOpts["select"] as (data: unknown) => unknown;
    const raw1 = makeRawChannel("ch-1");
    const raw2 = makeRawChannel("ch-2");
    const infiniteData = {
      pages: [{ data: [raw1, raw2], nextCursor: null }],
      pageParams: [undefined],
    };
    const result = select(infiniteData) as {
      pages: [{ data: [Record<string, unknown>, Record<string, unknown>] }];
    };
    expect(result.pages[0].data).toHaveLength(2);
    expect(result.pages[0].data[0]["name"]).toBe("general");
    expect(result.pages[0].data[1]["name"]).toBe("general");
  });
});

describe("useCreateChannel", () => {
  it("invalidates list on success", () => {
    mockUtils.channel.list.invalidate.mockClear();
    useCreateChannel();
    const onSuccess = lastCreateMutationOpts["onSuccess"] as () => void;
    onSuccess();
    expect(mockUtils.channel.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });
});

describe("useUpdateChannel", () => {
  it("invalidates get and list on success", () => {
    mockUtils.channel.get.invalidate.mockClear();
    mockUtils.channel.list.invalidate.mockClear();
    useUpdateChannel();
    const onSuccess = lastUpdateMutationOpts["onSuccess"] as (
      data: unknown,
      variables: { channelId: string },
    ) => void;
    onSuccess(undefined, { channelId: "ch-1" });
    expect(mockUtils.channel.get.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      channelId: "ch-1",
    });
    expect(mockUtils.channel.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });
});

describe("useArchiveChannel", () => {
  it("invalidates get and list on success", () => {
    mockUtils.channel.get.invalidate.mockClear();
    mockUtils.channel.list.invalidate.mockClear();
    useArchiveChannel();
    const onSuccess = lastArchiveMutationOpts["onSuccess"] as (
      data: unknown,
      variables: { channelId: string },
    ) => void;
    onSuccess(undefined, { channelId: "ch-2" });
    expect(mockUtils.channel.get.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      channelId: "ch-2",
    });
    expect(mockUtils.channel.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });
});

describe("useRestoreChannel", () => {
  it("invalidates get and list on success", () => {
    mockUtils.channel.get.invalidate.mockClear();
    mockUtils.channel.list.invalidate.mockClear();
    useRestoreChannel();
    const onSuccess = lastRestoreMutationOpts["onSuccess"] as (
      data: unknown,
      variables: { channelId: string },
    ) => void;
    onSuccess(undefined, { channelId: "ch-3" });
    expect(mockUtils.channel.get.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      channelId: "ch-3",
    });
    expect(mockUtils.channel.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });
});

describe("useDeleteChannel", () => {
  it("invalidates get and list on success", () => {
    mockUtils.channel.get.invalidate.mockClear();
    mockUtils.channel.list.invalidate.mockClear();
    useDeleteChannel();
    const onSuccess = lastDeleteMutationOpts["onSuccess"] as (
      data: unknown,
      variables: { channelId: string },
    ) => void;
    onSuccess(undefined, { channelId: "ch-4" });
    expect(mockUtils.channel.get.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      channelId: "ch-4",
    });
    expect(mockUtils.channel.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });
});
