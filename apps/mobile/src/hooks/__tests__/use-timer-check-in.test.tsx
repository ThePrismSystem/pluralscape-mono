// @vitest-environment happy-dom
import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { encryptTimerConfigInput } from "@pluralscape/data/transforms/timer-check-in";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { TEST_MASTER_KEY, TEST_SYSTEM_ID } from "./helpers/test-crypto.js";

import type { CheckInRecordRaw, TimerConfigRaw } from "@pluralscape/data/transforms/timer-check-in";
import type { CheckInRecordId, TimerId, UnixMillis } from "@pluralscape/types";

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
let lastTimerGetOpts: CapturedOpts = {};
let lastTimerListOpts: CapturedOpts = {};
let lastCreateTimerOpts: CapturedOpts = {};
let lastUpdateTimerOpts: CapturedOpts = {};
let lastDeleteTimerOpts: CapturedOpts = {};
let lastCheckInListOpts: CapturedOpts = {};
let lastCreateCheckInOpts: CapturedOpts = {};
let lastRespondOpts: CapturedOpts = {};
let lastDismissOpts: CapturedOpts = {};

const mockUtils = {
  timerConfig: {
    get: { invalidate: vi.fn() },
    list: { invalidate: vi.fn() },
  },
  checkInRecord: {
    get: { invalidate: vi.fn() },
    list: { invalidate: vi.fn() },
  },
};

vi.mock("@pluralscape/api-client/trpc", () => ({
  trpc: {
    timerConfig: {
      get: {
        useQuery: (_input: unknown, opts: CapturedOpts) => {
          lastTimerGetOpts = opts;
          return { data: undefined, isLoading: true, status: "loading" };
        },
      },
      list: {
        useInfiniteQuery: (_input: unknown, opts: CapturedOpts) => {
          lastTimerListOpts = opts;
          return { data: undefined, isLoading: true, status: "loading" };
        },
      },
      create: {
        useMutation: (opts: CapturedOpts) => {
          lastCreateTimerOpts = opts;
          return { mutate: vi.fn() };
        },
      },
      update: {
        useMutation: (opts: CapturedOpts) => {
          lastUpdateTimerOpts = opts;
          return { mutate: vi.fn() };
        },
      },
      delete: {
        useMutation: (opts: CapturedOpts) => {
          lastDeleteTimerOpts = opts;
          return { mutate: vi.fn() };
        },
      },
    },
    checkInRecord: {
      list: {
        useInfiniteQuery: (_input: unknown, opts: CapturedOpts) => {
          lastCheckInListOpts = opts;
          return { data: undefined, isLoading: true, status: "loading" };
        },
      },
      create: {
        useMutation: (opts: CapturedOpts) => {
          lastCreateCheckInOpts = opts;
          return { mutate: vi.fn() };
        },
      },
      respond: {
        useMutation: (opts: CapturedOpts) => {
          lastRespondOpts = opts;
          return { mutate: vi.fn() };
        },
      },
      dismiss: {
        useMutation: (opts: CapturedOpts) => {
          lastDismissOpts = opts;
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
  useTimerConfig,
  useTimerConfigsList,
  useCreateTimer,
  useUpdateTimer,
  useDeleteTimer,
  useCheckInHistory,
  useCreateCheckIn,
  useMarkCheckInResponded,
  useMarkCheckInDismissed,
} = await import("../use-timer-check-in.js");

// ── Fixtures ─────────────────────────────────────────────────────────
const NOW = 1_700_000_000_000 as UnixMillis;

function makeRawTimer(id: string): TimerConfigRaw {
  const encrypted = encryptTimerConfigInput({ promptText: "How are you?" }, TEST_MASTER_KEY);
  return {
    id: id as TimerId,
    systemId: TEST_SYSTEM_ID,
    enabled: true,
    intervalMinutes: 60,
    wakingHoursOnly: false,
    wakingStart: null,
    wakingEnd: null,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    archived: false,
    archivedAt: null,
    ...encrypted,
  };
}

function makeRawCheckIn(id: string): CheckInRecordRaw {
  return {
    id: id as CheckInRecordId,
    timerConfigId: "tmr-1" as TimerId,
    systemId: TEST_SYSTEM_ID,
    scheduledAt: NOW,
    respondedByMemberId: null,
    respondedAt: null,
    dismissed: false,
    archived: false,
    archivedAt: null,
  };
}

// ── Tests ────────────────────────────────────────────────────────────
describe("useTimerConfig", () => {
  it("enables when masterKey is present", () => {
    useTimerConfig("tmr-1" as TimerId);
    expect(lastTimerGetOpts["enabled"]).toBe(true);
  });

  it("disables when masterKey is null", () => {
    vi.mocked(useMasterKey).mockReturnValueOnce(null);
    useTimerConfig("tmr-1" as TimerId);
    expect(lastTimerGetOpts["enabled"]).toBe(false);
  });

  it("select decrypts raw timer correctly", () => {
    useTimerConfig("tmr-1" as TimerId);
    const select = lastTimerGetOpts["select"] as (raw: TimerConfigRaw) => unknown;
    const raw = makeRawTimer("tmr-1");
    const result = select(raw) as Record<string, unknown>;
    expect(result["promptText"]).toBe("How are you?");
    expect(result["enabled"]).toBe(true);
    expect(result["intervalMinutes"]).toBe(60);
    expect(result["archived"]).toBe(false);
  });
});

describe("useTimerConfigsList", () => {
  it("select decrypts each page item", () => {
    useTimerConfigsList();
    const select = lastTimerListOpts["select"] as (data: unknown) => unknown;
    const raw1 = makeRawTimer("tmr-1");
    const raw2 = makeRawTimer("tmr-2");
    const infiniteData = {
      pages: [{ data: [raw1, raw2], nextCursor: null }],
      pageParams: [undefined],
    };
    const result = select(infiniteData) as {
      pages: [{ data: [Record<string, unknown>, Record<string, unknown>] }];
    };
    expect(result.pages[0].data).toHaveLength(2);
    expect(result.pages[0].data[0]["promptText"]).toBe("How are you?");
    expect(result.pages[0].data[1]["promptText"]).toBe("How are you?");
  });
});

describe("useCheckInHistory", () => {
  it("select copies data without crypto", () => {
    useCheckInHistory();
    const select = lastCheckInListOpts["select"] as (data: unknown) => unknown;
    const raw1 = makeRawCheckIn("cir-1");
    const raw2 = makeRawCheckIn("cir-2");
    const infiniteData = {
      pages: [{ data: [raw1, raw2], nextCursor: null }],
      pageParams: [undefined],
    };
    const result = select(infiniteData) as {
      pages: [{ data: [Record<string, unknown>, Record<string, unknown>] }];
    };
    expect(result.pages[0].data).toHaveLength(2);
    expect(result.pages[0].data[0]["id"]).toBe("cir-1");
    expect(result.pages[0].data[1]["id"]).toBe("cir-2");
    expect(result.pages[0].data[0]["dismissed"]).toBe(false);
  });
});

describe("useCreateTimer", () => {
  it("invalidates list onSuccess", () => {
    mockUtils.timerConfig.list.invalidate.mockClear();
    useCreateTimer();
    const onSuccess = lastCreateTimerOpts["onSuccess"] as () => void;
    onSuccess();
    expect(mockUtils.timerConfig.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });
});

describe("useUpdateTimer", () => {
  it("invalidates get and list onSuccess", () => {
    mockUtils.timerConfig.get.invalidate.mockClear();
    mockUtils.timerConfig.list.invalidate.mockClear();
    useUpdateTimer();
    const onSuccess = lastUpdateTimerOpts["onSuccess"] as (
      data: unknown,
      variables: { timerId: string },
    ) => void;
    onSuccess(undefined, { timerId: "tmr-1" });
    expect(mockUtils.timerConfig.get.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      timerId: "tmr-1",
    });
    expect(mockUtils.timerConfig.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });
});

describe("useDeleteTimer", () => {
  it("invalidates get and list onSuccess", () => {
    mockUtils.timerConfig.get.invalidate.mockClear();
    mockUtils.timerConfig.list.invalidate.mockClear();
    useDeleteTimer();
    const onSuccess = lastDeleteTimerOpts["onSuccess"] as (
      data: unknown,
      variables: { timerId: string },
    ) => void;
    onSuccess(undefined, { timerId: "tmr-2" });
    expect(mockUtils.timerConfig.get.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      timerId: "tmr-2",
    });
    expect(mockUtils.timerConfig.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });
});

describe("useCreateCheckIn", () => {
  it("invalidates list onSuccess", () => {
    mockUtils.checkInRecord.list.invalidate.mockClear();
    useCreateCheckIn();
    const onSuccess = lastCreateCheckInOpts["onSuccess"] as () => void;
    onSuccess();
    expect(mockUtils.checkInRecord.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });
});

describe("useMarkCheckInResponded", () => {
  it("invalidates get and list onSuccess", () => {
    mockUtils.checkInRecord.get.invalidate.mockClear();
    mockUtils.checkInRecord.list.invalidate.mockClear();
    useMarkCheckInResponded();
    const onSuccess = lastRespondOpts["onSuccess"] as (
      data: unknown,
      variables: { recordId: string },
    ) => void;
    onSuccess(undefined, { recordId: "cir-1" });
    expect(mockUtils.checkInRecord.get.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      recordId: "cir-1",
    });
    expect(mockUtils.checkInRecord.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });
});

describe("useMarkCheckInDismissed", () => {
  it("invalidates get and list onSuccess", () => {
    mockUtils.checkInRecord.get.invalidate.mockClear();
    mockUtils.checkInRecord.list.invalidate.mockClear();
    useMarkCheckInDismissed();
    const onSuccess = lastDismissOpts["onSuccess"] as (
      data: unknown,
      variables: { recordId: string },
    ) => void;
    onSuccess(undefined, { recordId: "cir-2" });
    expect(mockUtils.checkInRecord.get.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      recordId: "cir-2",
    });
    expect(mockUtils.checkInRecord.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });
});
