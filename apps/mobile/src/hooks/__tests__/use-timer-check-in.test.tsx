// @vitest-environment happy-dom
import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { brandId } from "@pluralscape/types";
import { act, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { makeRawCheckIn, makeRawTimer } from "../../__tests__/factories/index.js";

import { renderHookWithProviders, TEST_SYSTEM_ID } from "./helpers/render-hook-with-providers.js";

import type { TimerId } from "@pluralscape/types";

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
  timerConfig: {
    get: { invalidate: vi.fn() },
    list: { invalidate: vi.fn() },
  },
  checkInRecord: {
    get: { invalidate: vi.fn() },
    list: { invalidate: vi.fn() },
  },
};

// ── tRPC mock backed by real React Query ─────────────────────────────
vi.mock("@pluralscape/api-client/trpc", async () => {
  const rq = await import("@tanstack/react-query");

  return {
    trpc: {
      timerConfig: {
        get: {
          useQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
            rq.useQuery({
              queryKey: ["timerConfig.get", input],
              queryFn: () => Promise.resolve(fixtures.get("timerConfig.get")),
              enabled: opts.enabled as boolean | undefined,
              select: opts.select as ((d: unknown) => unknown) | undefined,
            }),
        },
        list: {
          useInfiniteQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
            rq.useInfiniteQuery({
              queryKey: ["timerConfig.list", input],
              queryFn: () => Promise.resolve(fixtures.get("timerConfig.list")),
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
      checkInRecord: {
        list: {
          useInfiniteQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
            rq.useInfiniteQuery({
              queryKey: ["checkInRecord.list", input],
              queryFn: () => Promise.resolve(fixtures.get("checkInRecord.list")),
              enabled: opts.enabled as boolean | undefined,
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
        respond: {
          useMutation: (opts: Record<string, unknown> = {}) =>
            rq.useMutation({
              mutationFn: () => Promise.resolve({}),
              onSuccess: opts.onSuccess as
                | ((data: unknown, variables: unknown) => void)
                | undefined,
            }),
        },
        dismiss: {
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

beforeEach(() => {
  fixtures.clear();
  vi.clearAllMocks();
});

// ── Query tests ─────────────────────────────────────────────────────
describe("useTimerConfig", () => {
  it("returns decrypted timer config data", async () => {
    fixtures.set("timerConfig.get", makeRawTimer("tmr-1"));
    const { result } = renderHookWithProviders(() => useTimerConfig(brandId<TimerId>("tmr-1")));

    let data: Awaited<ReturnType<typeof useTimerConfig>>["data"] | undefined;
    await waitFor(() => {
      data = result.current.data;
      expect(result.current.isSuccess).toBe(true);
    });
    expect(data?.promptText).toBe("How are you?");
    expect(data?.enabled).toBe(true);
    expect(data?.intervalMinutes).toBe(60);
    expect(data?.archived).toBe(false);
  });

  it("does not fetch when masterKey is null", () => {
    const { result } = renderHookWithProviders(() => useTimerConfig(brandId<TimerId>("tmr-1")), {
      masterKey: null,
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });

  it("select is stable across rerenders (useCallback memoization)", async () => {
    fixtures.set("timerConfig.get", makeRawTimer("tmr-1"));
    const { result, rerender } = renderHookWithProviders(() =>
      useTimerConfig(brandId<TimerId>("tmr-1")),
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const ref1 = result.current.data;
    rerender();
    expect(result.current.data).toBe(ref1);
  });
});

describe("useTimerConfigsList", () => {
  it("returns decrypted paginated timer configs", async () => {
    const raw1 = makeRawTimer("tmr-1");
    const raw2 = makeRawTimer("tmr-2");
    fixtures.set("timerConfig.list", { data: [raw1, raw2], nextCursor: null });

    const { result } = renderHookWithProviders(() => useTimerConfigsList());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const timerData = result.current.data;
    const pages = timerData && "pages" in timerData ? timerData.pages : [];
    expect(pages).toHaveLength(1);
    expect(pages[0]?.data).toHaveLength(2);
    expect(pages[0]?.data[0]?.promptText).toBe("How are you?");
    expect(pages[0]?.data[1]?.promptText).toBe("How are you?");
  });

  it("does not fetch when masterKey is null", () => {
    const { result } = renderHookWithProviders(() => useTimerConfigsList(), { masterKey: null });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("select is stable across rerenders", async () => {
    fixtures.set("timerConfig.list", { data: [makeRawTimer("tmr-1")], nextCursor: null });
    const { result, rerender } = renderHookWithProviders(() => useTimerConfigsList());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const ref1 = result.current.data;
    rerender();
    expect(result.current.data).toBe(ref1);
  });
});

describe("useCheckInHistory", () => {
  it("returns raw check-in records without decryption", async () => {
    const raw1 = makeRawCheckIn("cir-1");
    const raw2 = makeRawCheckIn("cir-2");
    fixtures.set("checkInRecord.list", { data: [raw1, raw2], nextCursor: null });

    const { result } = renderHookWithProviders(() => useCheckInHistory());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const checkInData = result.current.data;
    const pages = checkInData && "pages" in checkInData ? checkInData.pages : [];
    expect(pages).toHaveLength(1);
    expect(pages[0]?.data).toHaveLength(2);
    expect(pages[0]?.data[0]?.id).toBe("cir-1");
    expect(pages[0]?.data[1]?.id).toBe("cir-2");
    expect(pages[0]?.data[0]?.dismissed).toBe(false);
  });

  it("fetches regardless of masterKey (no enabled guard)", async () => {
    const raw1 = makeRawCheckIn("cir-1");
    fixtures.set("checkInRecord.list", { data: [raw1], nextCursor: null });

    const { result } = renderHookWithProviders(() => useCheckInHistory(), { masterKey: null });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const d = result.current.data;
    expect(d && "pages" in d ? d.pages[0]?.data[0]?.id : undefined).toBe("cir-1");
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

const LOCAL_TIMER_ROW: Record<string, unknown> = {
  id: "tmr-local-1",
  system_id: TEST_SYSTEM_ID,
  interval_minutes: 30,
  waking_hours_only: 1,
  waking_start: "08:00",
  waking_end: "22:00",
  prompt_text: "Local timer prompt",
  enabled: 1,
  archived: 0,
  created_at: 1_700_000_000_000,
  updated_at: 1_700_000_000_000,
};

const LOCAL_CHECK_IN_ROW: Record<string, unknown> = {
  id: "cir-local-1",
  timer_config_id: "tmr-local-1",
  system_id: TEST_SYSTEM_ID,
  scheduled_at: 1_700_000_000_000,
  responded_by_member_id: null,
  responded_at: null,
  dismissed: 0,
  archived: 0,
  archived_at: null,
  created_at: 1_700_000_000_000,
  updated_at: 1_700_000_000_000,
};

describe("useTimerConfig (local source)", () => {
  it("returns transformed local row data", async () => {
    const localDb = createMockLocalDb([LOCAL_TIMER_ROW]);
    const { result } = renderHookWithProviders(
      () => useTimerConfig(brandId<TimerId>("tmr-local-1")),
      {
        querySource: "local",
        localDb,
      },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(localDb.queryOne).toHaveBeenCalledWith(expect.stringContaining("timer_configs"), [
      "tmr-local-1",
    ]);
    expect(result.current.data).toMatchObject({
      id: "tmr-local-1",
      promptText: "Local timer prompt",
      enabled: true,
      intervalMinutes: 30,
      wakingHoursOnly: true,
    });
  });

  it("does not call tRPC in local mode", async () => {
    const localDb = createMockLocalDb([LOCAL_TIMER_ROW]);
    const { result } = renderHookWithProviders(
      () => useTimerConfig(brandId<TimerId>("tmr-local-1")),
      {
        querySource: "local",
        localDb,
      },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.promptText).toBe("Local timer prompt");
  });
});

describe("useTimerConfigsList (local source)", () => {
  it("returns flat array of transformed rows", async () => {
    const row2 = { ...LOCAL_TIMER_ROW, id: "tmr-local-2", prompt_text: "Second timer" };
    const localDb = createMockLocalDb([LOCAL_TIMER_ROW, row2]);
    const { result } = renderHookWithProviders(() => useTimerConfigsList(), {
      querySource: "local",
      localDb,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(localDb.queryAll).toHaveBeenCalledWith(
      expect.stringContaining("timer_configs"),
      expect.arrayContaining([TEST_SYSTEM_ID]),
    );

    const data = result.current.data;
    const pages = data && "pages" in data ? data.pages : [];
    expect(pages).toHaveLength(1);
    const items = pages[0] && "data" in pages[0] ? pages[0].data : [];
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ promptText: "Local timer prompt" });
    expect(items[1]).toMatchObject({ promptText: "Second timer" });
  });

  it("does not require masterKey in local mode", async () => {
    const localDb = createMockLocalDb([LOCAL_TIMER_ROW]);
    const { result } = renderHookWithProviders(() => useTimerConfigsList(), {
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

describe("useCheckInHistory (local source)", () => {
  it("returns flat array of transformed check-in records", async () => {
    const row2 = { ...LOCAL_CHECK_IN_ROW, id: "cir-local-2" };
    const localDb = createMockLocalDb([LOCAL_CHECK_IN_ROW, row2]);
    const { result } = renderHookWithProviders(() => useCheckInHistory(), {
      querySource: "local",
      localDb,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(localDb.queryAll).toHaveBeenCalledWith(
      expect.stringContaining("check_in_records"),
      expect.arrayContaining([TEST_SYSTEM_ID]),
    );

    const data = result.current.data;
    expect(Array.isArray(data)).toBe(true);
    const items = Array.isArray(data) ? data : [];
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ id: "cir-local-1", dismissed: false });
    expect(items[1]).toMatchObject({ id: "cir-local-2" });
  });

  it("does not require masterKey in local mode", async () => {
    const localDb = createMockLocalDb([LOCAL_CHECK_IN_ROW]);
    const { result } = renderHookWithProviders(() => useCheckInHistory(), {
      querySource: "local",
      localDb,
      masterKey: null,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(1);
  });
});

// ── Mutation tests ──────────────────────────────────────────────────
describe("useCreateTimer", () => {
  it("invalidates timerConfig.list on success", async () => {
    const { result } = renderHookWithProviders(() => useCreateTimer());

    await act(() => result.current.mutateAsync({} as never));

    await waitFor(() => {
      expect(mockUtils.timerConfig.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useUpdateTimer", () => {
  it("invalidates timerConfig.get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useUpdateTimer());

    await act(() => result.current.mutateAsync({ timerId: "tmr-1" } as never));

    await waitFor(() => {
      expect(mockUtils.timerConfig.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        timerId: "tmr-1",
      });
      expect(mockUtils.timerConfig.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useDeleteTimer", () => {
  it("invalidates timerConfig.get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useDeleteTimer());

    await act(() => result.current.mutateAsync({ timerId: "tmr-2" } as never));

    await waitFor(() => {
      expect(mockUtils.timerConfig.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        timerId: "tmr-2",
      });
      expect(mockUtils.timerConfig.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useCreateCheckIn", () => {
  it("invalidates checkInRecord.list on success", async () => {
    const { result } = renderHookWithProviders(() => useCreateCheckIn());

    await act(() => result.current.mutateAsync({} as never));

    await waitFor(() => {
      expect(mockUtils.checkInRecord.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useMarkCheckInResponded", () => {
  it("invalidates checkInRecord.get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useMarkCheckInResponded());

    await act(() => result.current.mutateAsync({ recordId: "cir-1" } as never));

    await waitFor(() => {
      expect(mockUtils.checkInRecord.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        recordId: "cir-1",
      });
      expect(mockUtils.checkInRecord.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useMarkCheckInDismissed", () => {
  it("invalidates checkInRecord.get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useMarkCheckInDismissed());

    await act(() => result.current.mutateAsync({ recordId: "cir-2" } as never));

    await waitFor(() => {
      expect(mockUtils.checkInRecord.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        recordId: "cir-2",
      });
      expect(mockUtils.checkInRecord.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});
