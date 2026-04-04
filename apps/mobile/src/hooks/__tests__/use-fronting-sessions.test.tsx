// @vitest-environment happy-dom
import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { encryptFrontingSessionInput } from "@pluralscape/data/transforms/fronting-session";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { TEST_MASTER_KEY, TEST_SYSTEM_ID } from "./helpers/test-crypto.js";

import type { FrontingSessionRaw } from "@pluralscape/data/transforms/fronting-session";
import type { FrontingSessionId, MemberId, UnixMillis } from "@pluralscape/types";

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
let lastGetOpts: CapturedOpts = {};
let lastListOpts: CapturedOpts = {};
let lastGetActiveOpts: CapturedOpts = {};
let lastCreateMutationOpts: CapturedOpts = {};
let lastEndMutationOpts: CapturedOpts = {};
let lastUpdateMutationOpts: CapturedOpts = {};

const mockUtils = {
  frontingSession: {
    get: { invalidate: vi.fn(), cancel: vi.fn(), getData: vi.fn(), setData: vi.fn() },
    list: { invalidate: vi.fn(), cancel: vi.fn() },
    getActive: { invalidate: vi.fn() },
  },
};

vi.mock("@pluralscape/api-client/trpc", () => ({
  trpc: {
    frontingSession: {
      get: {
        useQuery: (_input: unknown, opts: CapturedOpts) => {
          lastGetOpts = opts;
          return { data: undefined, isLoading: true, status: "loading" };
        },
      },
      list: {
        useInfiniteQuery: (_input: unknown, opts: CapturedOpts) => {
          lastListOpts = opts;
          return { data: undefined, isLoading: true, status: "loading" };
        },
      },
      getActive: {
        useQuery: (_input: unknown, opts: CapturedOpts) => {
          lastGetActiveOpts = opts;
          return { data: undefined, isLoading: true, status: "loading" };
        },
      },
      create: {
        useMutation: (opts: CapturedOpts) => {
          lastCreateMutationOpts = opts;
          return { mutate: vi.fn() };
        },
      },
      end: {
        useMutation: (opts: CapturedOpts) => {
          lastEndMutationOpts = opts;
          return { mutate: vi.fn() };
        },
      },
      update: {
        useMutation: (opts: CapturedOpts) => {
          lastUpdateMutationOpts = opts;
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
  useFrontingSession,
  useFrontingSessionsList,
  useActiveFronters,
  useStartSession,
  useEndSession,
  useUpdateSession,
} = await import("../use-fronting-sessions.js");

// ── Fixtures ─────────────────────────────────────────────────────────
const NOW = 1_700_000_000_000 as UnixMillis;

function makeRawSession(id: string): FrontingSessionRaw {
  const encrypted = encryptFrontingSessionInput(
    {
      comment: `Session ${id}`,
      positionality: "close",
      outtrigger: null,
      outtriggerSentiment: null,
    },
    TEST_MASTER_KEY,
  );
  return {
    id: id as FrontingSessionId,
    systemId: TEST_SYSTEM_ID,
    memberId: "m-1" as MemberId,
    customFrontId: null,
    structureEntityId: null,
    startTime: NOW,
    endTime: null,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    archived: false,
    archivedAt: null,
    ...encrypted,
  };
}

// ── Tests ────────────────────────────────────────────────────────────
describe("useFrontingSession", () => {
  it("enables when masterKey is present", () => {
    useFrontingSession("fs-1" as FrontingSessionId);
    expect(lastGetOpts["enabled"]).toBe(true);
  });

  it("disables when masterKey is null", () => {
    vi.mocked(useMasterKey).mockReturnValueOnce(null);
    useFrontingSession("fs-1" as FrontingSessionId);
    expect(lastGetOpts["enabled"]).toBe(false);
  });

  it("select decrypts raw session correctly", () => {
    useFrontingSession("fs-1" as FrontingSessionId);
    const select = lastGetOpts["select"] as (raw: FrontingSessionRaw) => unknown;
    const raw = makeRawSession("fs-1");
    const result = select(raw) as Record<string, unknown>;
    expect(result["comment"]).toBe("Session fs-1");
    expect(result["positionality"]).toBe("close");
    expect(result["outtrigger"]).toBeNull();
    expect(result["archived"]).toBe(false);
    expect(result["endTime"]).toBeNull();
  });
});

describe("useFrontingSessionsList", () => {
  it("select decrypts each page item", () => {
    useFrontingSessionsList();
    const select = lastListOpts["select"] as (data: unknown) => unknown;
    const raw1 = makeRawSession("fs-1");
    const raw2 = makeRawSession("fs-2");
    const infiniteData = {
      pages: [{ data: [raw1, raw2], nextCursor: null }],
      pageParams: [undefined],
    };
    const result = select(infiniteData) as {
      pages: [{ data: [Record<string, unknown>, Record<string, unknown>] }];
    };
    expect(result.pages[0].data).toHaveLength(2);
    expect(result.pages[0].data[0]["comment"]).toBe("Session fs-1");
    expect(result.pages[0].data[1]["comment"]).toBe("Session fs-2");
  });
});

describe("useActiveFronters", () => {
  it("enables when masterKey is present", () => {
    useActiveFronters();
    expect(lastGetActiveOpts["enabled"]).toBe(true);
  });

  it("disables when masterKey is null", () => {
    vi.mocked(useMasterKey).mockReturnValueOnce(null);
    useActiveFronters();
    expect(lastGetActiveOpts["enabled"]).toBe(false);
  });

  it("select decrypts sessions and passes through isCofronting and entityMemberMap", () => {
    useActiveFronters();
    const select = lastGetActiveOpts["select"] as (raw: unknown) => unknown;
    const raw1 = makeRawSession("fs-1");
    const rawGetActive = {
      sessions: [raw1],
      isCofronting: true,
      entityMemberMap: { "m-1": ["fs-1"] },
    };
    const result = select(rawGetActive) as Record<string, unknown>;
    expect(result["isCofronting"]).toBe(true);
    expect(result["entityMemberMap"]).toEqual({ "m-1": ["fs-1"] });
    const sessions = result["sessions"] as Record<string, unknown>[];
    expect(sessions).toHaveLength(1);
    const first = sessions.at(0) ?? {};
    expect(first["comment"]).toBe("Session fs-1");
  });
});

describe("useStartSession", () => {
  it("invalidates list and getActive onSettled", () => {
    mockUtils.frontingSession.list.invalidate.mockClear();
    mockUtils.frontingSession.getActive.invalidate.mockClear();
    useStartSession();
    const onSettled = lastCreateMutationOpts["onSettled"] as () => void;
    onSettled();
    expect(mockUtils.frontingSession.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
    expect(mockUtils.frontingSession.getActive.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });
});

describe("useEndSession", () => {
  it("invalidates list, get, and getActive onSettled", () => {
    mockUtils.frontingSession.list.invalidate.mockClear();
    mockUtils.frontingSession.get.invalidate.mockClear();
    mockUtils.frontingSession.getActive.invalidate.mockClear();
    useEndSession();
    const onSettled = lastEndMutationOpts["onSettled"] as (
      data: unknown,
      err: unknown,
      variables: { sessionId: string },
    ) => void;
    onSettled(undefined, undefined, { sessionId: "fs-1" });
    expect(mockUtils.frontingSession.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
    expect(mockUtils.frontingSession.get.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      sessionId: "fs-1",
    });
    expect(mockUtils.frontingSession.getActive.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });
});

describe("useUpdateSession", () => {
  it("invalidates get and list onSuccess", () => {
    mockUtils.frontingSession.get.invalidate.mockClear();
    mockUtils.frontingSession.list.invalidate.mockClear();
    useUpdateSession();
    const onSuccess = lastUpdateMutationOpts["onSuccess"] as (
      data: unknown,
      variables: { sessionId: string },
    ) => void;
    onSuccess(undefined, { sessionId: "fs-1" });
    expect(mockUtils.frontingSession.get.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      sessionId: "fs-1",
    });
    expect(mockUtils.frontingSession.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });
});
