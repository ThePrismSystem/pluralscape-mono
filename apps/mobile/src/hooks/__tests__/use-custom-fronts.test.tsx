// @vitest-environment happy-dom
import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { encryptCustomFrontInput } from "@pluralscape/data/transforms/custom-front";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { TEST_MASTER_KEY, TEST_SYSTEM_ID } from "./helpers/test-crypto.js";

import type { CustomFrontRaw } from "@pluralscape/data/transforms/custom-front";
import type { CustomFrontId, UnixMillis } from "@pluralscape/types";

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
let lastCreateOpts: CapturedOpts = {};
let lastUpdateOpts: CapturedOpts = {};
let lastDeleteOpts: CapturedOpts = {};

const mockUtils = {
  customFront: {
    get: { invalidate: vi.fn() },
    list: { invalidate: vi.fn() },
  },
};

vi.mock("@pluralscape/api-client/trpc", () => ({
  trpc: {
    customFront: {
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
          lastCreateOpts = opts;
          return { mutate: vi.fn() };
        },
      },
      update: {
        useMutation: (opts: CapturedOpts) => {
          lastUpdateOpts = opts;
          return { mutate: vi.fn() };
        },
      },
      delete: {
        useMutation: (opts: CapturedOpts) => {
          lastDeleteOpts = opts;
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
  useCustomFront,
  useCustomFrontsList,
  useCreateCustomFront,
  useUpdateCustomFront,
  useDeleteCustomFront,
} = await import("../use-custom-fronts.js");

// ── Fixtures ─────────────────────────────────────────────────────────
const NOW = 1_700_000_000_000 as UnixMillis;

function makeRawCustomFront(id: string): CustomFrontRaw {
  const encrypted = encryptCustomFrontInput(
    { name: `Front ${id}`, description: "A test front", color: null, emoji: null },
    TEST_MASTER_KEY,
  );
  return {
    id: id as CustomFrontId,
    systemId: TEST_SYSTEM_ID,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    archived: false,
    archivedAt: null,
    ...encrypted,
  };
}

// ── Tests ────────────────────────────────────────────────────────────
describe("useCustomFront", () => {
  it("enables when masterKey is present", () => {
    useCustomFront("cf-1" as CustomFrontId);
    expect(lastQueryOpts["enabled"]).toBe(true);
  });

  it("disables when masterKey is null", () => {
    vi.mocked(useMasterKey).mockReturnValueOnce(null);
    useCustomFront("cf-1" as CustomFrontId);
    expect(lastQueryOpts["enabled"]).toBe(false);
  });

  it("select decrypts raw custom front correctly", () => {
    useCustomFront("cf-1" as CustomFrontId);
    const select = lastQueryOpts["select"] as (raw: CustomFrontRaw) => unknown;
    const raw = makeRawCustomFront("cf-1");
    const result = select(raw) as Record<string, unknown>;
    expect(result["name"]).toBe("Front cf-1");
    expect(result["description"]).toBe("A test front");
    expect(result["archived"]).toBe(false);
  });
});

describe("useCustomFrontsList", () => {
  it("select decrypts each page item", () => {
    useCustomFrontsList();
    const select = lastInfiniteOpts["select"] as (data: unknown) => unknown;
    const raw1 = makeRawCustomFront("cf-1");
    const raw2 = makeRawCustomFront("cf-2");
    const infiniteData = {
      pages: [{ data: [raw1, raw2], nextCursor: null }],
      pageParams: [undefined],
    };
    const result = select(infiniteData) as {
      pages: [{ data: [Record<string, unknown>, Record<string, unknown>] }];
    };
    expect(result.pages[0].data).toHaveLength(2);
    expect(result.pages[0].data[0]["name"]).toBe("Front cf-1");
    expect(result.pages[0].data[1]["name"]).toBe("Front cf-2");
  });
});

describe("useCreateCustomFront", () => {
  it("invalidates list on success", () => {
    mockUtils.customFront.list.invalidate.mockClear();
    useCreateCustomFront();
    const onSuccess = lastCreateOpts["onSuccess"] as () => void;
    onSuccess();
    expect(mockUtils.customFront.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });
});

describe("useUpdateCustomFront", () => {
  it("invalidates get and list on success", () => {
    mockUtils.customFront.get.invalidate.mockClear();
    mockUtils.customFront.list.invalidate.mockClear();
    useUpdateCustomFront();
    const onSuccess = lastUpdateOpts["onSuccess"] as (
      data: unknown,
      variables: { customFrontId: string },
    ) => void;
    onSuccess(undefined, { customFrontId: "cf-1" });
    expect(mockUtils.customFront.get.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      customFrontId: "cf-1",
    });
    expect(mockUtils.customFront.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });
});

describe("useDeleteCustomFront", () => {
  it("invalidates get and list on success", () => {
    mockUtils.customFront.get.invalidate.mockClear();
    mockUtils.customFront.list.invalidate.mockClear();
    useDeleteCustomFront();
    const onSuccess = lastDeleteOpts["onSuccess"] as (
      data: unknown,
      variables: { customFrontId: string },
    ) => void;
    onSuccess(undefined, { customFrontId: "cf-2" });
    expect(mockUtils.customFront.get.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      customFrontId: "cf-2",
    });
    expect(mockUtils.customFront.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });
});
