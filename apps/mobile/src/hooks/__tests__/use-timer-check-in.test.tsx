// @vitest-environment happy-dom
import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { encryptTimerConfigInput } from "@pluralscape/data/transforms/timer-check-in";
import { act, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  renderHookWithProviders,
  TEST_MASTER_KEY,
  TEST_SYSTEM_ID,
} from "./helpers/render-hook-with-providers.js";

import type { CheckInRecordRaw, TimerConfigRaw } from "@pluralscape/data/transforms/timer-check-in";
import type { CheckInRecordId, TimerId, UnixMillis } from "@pluralscape/types";

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

beforeEach(() => {
  fixtures.clear();
  vi.clearAllMocks();
});

// ── Query tests ─────────────────────────────────────────────────────
describe("useTimerConfig", () => {
  it("returns decrypted timer config data", async () => {
    fixtures.set("timerConfig.get", makeRawTimer("tmr-1"));
    const { result } = renderHookWithProviders(() => useTimerConfig("tmr-1" as TimerId));

    let data: Awaited<ReturnType<typeof useTimerConfig>>["data"] | undefined;
    await waitFor(() => {
      data = result.current.data;
      expect(data).toBeDefined();
    });
    expect(data?.promptText).toBe("How are you?");
    expect(data?.enabled).toBe(true);
    expect(data?.intervalMinutes).toBe(60);
    expect(data?.archived).toBe(false);
  });

  it("does not fetch when masterKey is null", () => {
    const { result } = renderHookWithProviders(() => useTimerConfig("tmr-1" as TimerId), {
      masterKey: null,
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });

  it("select is stable across rerenders (useCallback memoization)", async () => {
    fixtures.set("timerConfig.get", makeRawTimer("tmr-1"));
    const { result, rerender } = renderHookWithProviders(() => useTimerConfig("tmr-1" as TimerId));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
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
      expect(result.current.data).toBeDefined();
    });
    const pages = result.current.data?.pages ?? [];
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
      expect(result.current.data).toBeDefined();
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
      expect(result.current.data).toBeDefined();
    });
    const pages = result.current.data?.pages ?? [];
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
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data?.pages[0]?.data[0]?.id).toBe("cir-1");
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
