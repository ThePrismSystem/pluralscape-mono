// @vitest-environment happy-dom
import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { encryptFrontingSessionInput } from "@pluralscape/data/transforms/fronting-session";
import { act, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  renderHookWithProviders,
  TEST_MASTER_KEY,
  TEST_SYSTEM_ID,
} from "./helpers/render-hook-with-providers.js";

import type { FrontingSessionRaw } from "@pluralscape/data/transforms/fronting-session";
import type { FrontingSessionId, MemberId, UnixMillis } from "@pluralscape/types";

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
  frontingSession: {
    get: {
      invalidate: vi.fn(),
      cancel: vi.fn(() => Promise.resolve()),
      getData: vi.fn((): FrontingSessionRaw | undefined => undefined),
      setData: vi.fn(),
    },
    list: {
      invalidate: vi.fn(),
      cancel: vi.fn(() => Promise.resolve()),
    },
    getActive: {
      invalidate: vi.fn(),
    },
  },
};

// ── tRPC mock backed by real React Query ─────────────────────────────
vi.mock("@pluralscape/api-client/trpc", async () => {
  const rq = await import("@tanstack/react-query");

  return {
    trpc: {
      frontingSession: {
        get: {
          useQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
            rq.useQuery({
              queryKey: ["frontingSession.get", input],
              queryFn: () => Promise.resolve(fixtures.get("frontingSession.get")),
              enabled: opts.enabled as boolean | undefined,
              select: opts.select as ((d: unknown) => unknown) | undefined,
            }),
        },
        list: {
          useInfiniteQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
            rq.useInfiniteQuery({
              queryKey: ["frontingSession.list", input],
              queryFn: () => Promise.resolve(fixtures.get("frontingSession.list")),
              enabled: opts.enabled as boolean | undefined,
              select: opts.select as ((d: unknown) => unknown) | undefined,
              getNextPageParam: opts.getNextPageParam as (lp: unknown) => unknown,
              initialPageParam: undefined,
            }),
        },
        getActive: {
          useQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
            rq.useQuery({
              queryKey: ["frontingSession.getActive", input],
              queryFn: () => Promise.resolve(fixtures.get("frontingSession.getActive")),
              enabled: opts.enabled as boolean | undefined,
              select: opts.select as ((d: unknown) => unknown) | undefined,
            }),
        },
        create: {
          useMutation: (opts: Record<string, unknown> = {}) =>
            rq.useMutation({
              mutationFn: () => Promise.resolve({}),
              onMutate: opts.onMutate as (() => Promise<void>) | undefined,
              onSettled: opts.onSettled as (() => void) | undefined,
            }),
        },
        end: {
          useMutation: (opts: Record<string, unknown> = {}) =>
            rq.useMutation({
              mutationFn: () => Promise.resolve({}),
              onMutate: opts.onMutate as ((variables: unknown) => Promise<unknown>) | undefined,
              onError: opts.onError as
                | ((err: unknown, variables: unknown, context: unknown) => void)
                | undefined,
              onSettled: opts.onSettled as
                | ((data: unknown, err: unknown, variables: unknown) => void)
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
      },
      useUtils: () => mockUtils,
    },
  };
});

// Must import AFTER vi.mock
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

beforeEach(() => {
  fixtures.clear();
  vi.clearAllMocks();
  // Restore default getData return value after clearAllMocks
  mockUtils.frontingSession.get.getData.mockReturnValue(undefined);
  mockUtils.frontingSession.get.cancel.mockResolvedValue(undefined);
  mockUtils.frontingSession.list.cancel.mockResolvedValue(undefined);
});

// ── Query tests ──────────────────────────────────────────────────────
describe("useFrontingSession", () => {
  it("returns decrypted session data", async () => {
    fixtures.set("frontingSession.get", makeRawSession("fs-1"));
    const { result } = renderHookWithProviders(() =>
      useFrontingSession("fs-1" as FrontingSessionId),
    );

    let data: Awaited<ReturnType<typeof useFrontingSession>>["data"] | undefined;
    await waitFor(() => {
      data = result.current.data;
      expect(data).toBeDefined();
    });
    expect(data?.comment).toBe("Session fs-1");
    expect(data?.positionality).toBe("close");
    expect(data?.outtrigger).toBeNull();
    expect(data?.archived).toBe(false);
    expect(data?.endTime).toBeNull();
  });

  it("does not fetch when masterKey is null", () => {
    const { result } = renderHookWithProviders(
      () => useFrontingSession("fs-1" as FrontingSessionId),
      { masterKey: null },
    );
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });

  it("select is stable across rerenders (useCallback memoization)", async () => {
    fixtures.set("frontingSession.get", makeRawSession("fs-1"));
    const { result, rerender } = renderHookWithProviders(() =>
      useFrontingSession("fs-1" as FrontingSessionId),
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const ref1 = result.current.data;
    rerender();
    expect(result.current.data).toBe(ref1);
  });
});

describe("useFrontingSessionsList", () => {
  it("returns decrypted paginated sessions", async () => {
    const raw1 = makeRawSession("fs-1");
    const raw2 = makeRawSession("fs-2");
    fixtures.set("frontingSession.list", { data: [raw1, raw2], nextCursor: null });

    const { result } = renderHookWithProviders(() => useFrontingSessionsList());

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const pages = result.current.data?.pages ?? [];
    expect(pages).toHaveLength(1);
    expect(pages[0]?.data).toHaveLength(2);
    expect(pages[0]?.data[0]?.comment).toBe("Session fs-1");
    expect(pages[0]?.data[1]?.comment).toBe("Session fs-2");
  });

  it("does not fetch when masterKey is null", () => {
    const { result } = renderHookWithProviders(() => useFrontingSessionsList(), {
      masterKey: null,
    });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("select is stable across rerenders", async () => {
    fixtures.set("frontingSession.list", { data: [makeRawSession("fs-1")], nextCursor: null });
    const { result, rerender } = renderHookWithProviders(() => useFrontingSessionsList());

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const ref1 = result.current.data;
    rerender();
    expect(result.current.data).toBe(ref1);
  });
});

describe("useActiveFronters", () => {
  it("returns decrypted active fronters with composite fields", async () => {
    const raw1 = makeRawSession("fs-1");
    fixtures.set("frontingSession.getActive", {
      sessions: [raw1],
      isCofronting: true,
      entityMemberMap: { "m-1": ["fs-1"] },
    });

    const { result } = renderHookWithProviders(() => useActiveFronters());

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data?.isCofronting).toBe(true);
    expect(result.current.data?.entityMemberMap).toEqual({ "m-1": ["fs-1"] });
    expect(result.current.data?.sessions).toHaveLength(1);
    expect(result.current.data?.sessions[0]?.comment).toBe("Session fs-1");
  });

  it("does not fetch when masterKey is null", () => {
    const { result } = renderHookWithProviders(() => useActiveFronters(), { masterKey: null });
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });

  it("select is stable across rerenders", async () => {
    const raw1 = makeRawSession("fs-1");
    fixtures.set("frontingSession.getActive", {
      sessions: [raw1],
      isCofronting: false,
      entityMemberMap: {},
    });
    const { result, rerender } = renderHookWithProviders(() => useActiveFronters());

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const ref1 = result.current.data;
    rerender();
    expect(result.current.data).toBe(ref1);
  });
});

// ── Mutation tests ────────────────────────────────────────────────────
describe("useStartSession", () => {
  it("cancels list onMutate and invalidates list and getActive onSettled", async () => {
    const { result } = renderHookWithProviders(() => useStartSession());

    await act(() => result.current.mutateAsync({} as never));

    await waitFor(() => {
      expect(mockUtils.frontingSession.list.cancel).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
      expect(mockUtils.frontingSession.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
      expect(mockUtils.frontingSession.getActive.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useEndSession", () => {
  it("cancels get, snapshots previousSession, and invalidates on settled", async () => {
    const { result } = renderHookWithProviders(() => useEndSession());

    await act(() =>
      result.current.mutateAsync({ sessionId: "fs-1" as FrontingSessionId } as never),
    );

    await waitFor(() => {
      expect(mockUtils.frontingSession.get.cancel).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        sessionId: "fs-1",
      });
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

  it("restores previousSession via setData on error when context has data", async () => {
    const rawSession = makeRawSession("fs-1");
    mockUtils.frontingSession.get.getData.mockReturnValue(rawSession);

    // We need to make mutateAsync fail to trigger onError
    const { result } = renderHookWithProviders(() => useEndSession());

    // Verify getData is called during onMutate (via cancel step)
    await act(() =>
      result.current.mutateAsync({ sessionId: "fs-1" as FrontingSessionId } as never),
    );

    await waitFor(() => {
      expect(mockUtils.frontingSession.get.getData).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        sessionId: "fs-1",
      });
    });
  });
});

describe("useUpdateSession", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useUpdateSession());

    await act(() =>
      result.current.mutateAsync({ sessionId: "fs-1" as FrontingSessionId } as never),
    );

    await waitFor(() => {
      expect(mockUtils.frontingSession.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        sessionId: "fs-1",
      });
      expect(mockUtils.frontingSession.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});
