// @vitest-environment happy-dom
import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { encryptSnapshotInput } from "@pluralscape/data/transforms/snapshot";
import { act, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  renderHookWithProviders,
  TEST_MASTER_KEY,
  TEST_SYSTEM_ID,
} from "./helpers/render-hook-with-providers.js";

import type { SnapshotRaw } from "@pluralscape/data/transforms/snapshot";
import type { SnapshotContent, SystemSnapshotId, UnixMillis } from "@pluralscape/types";

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
  snapshot: {
    get: { invalidate: vi.fn() },
    list: { invalidate: vi.fn() },
  },
};

// ── tRPC mock backed by real React Query ─────────────────────────────
vi.mock("@pluralscape/api-client/trpc", async () => {
  const rq = await import("@tanstack/react-query");

  return {
    trpc: {
      snapshot: {
        get: {
          useQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
            rq.useQuery({
              queryKey: ["snapshot.get", input],
              queryFn: () => Promise.resolve(fixtures.get("snapshot.get")),
              enabled: opts.enabled as boolean | undefined,
              select: opts.select as ((d: unknown) => unknown) | undefined,
            }),
        },
        list: {
          useInfiniteQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
            rq.useInfiniteQuery({
              queryKey: ["snapshot.list", input],
              queryFn: () => Promise.resolve(fixtures.get("snapshot.list")),
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
      useUtils: () => mockUtils,
    },
  };
});

// Must import AFTER vi.mock
const { useSnapshot, useSnapshotsList, useCreateSnapshot, useDeleteSnapshot } =
  await import("../use-snapshots.js");

// ── Fixtures ─────────────────────────────────────────────────────────
const NOW = 1_700_000_000_000 as UnixMillis;

function makeSnapshotContent(): SnapshotContent {
  return {
    name: "Test Snapshot",
    description: null,
    members: [],
    structureEntityTypes: [],
    structureEntities: [],
    structureEntityLinks: [],
    structureEntityMemberLinks: [],
    structureEntityAssociations: [],
    relationships: [],
    groups: [],
    innerworldRegions: [],
    innerworldEntities: [],
  };
}

function makeRawSnapshot(id: string): SnapshotRaw {
  const content = makeSnapshotContent();
  const encrypted = encryptSnapshotInput(content, TEST_MASTER_KEY);
  return {
    id: id as SystemSnapshotId,
    systemId: TEST_SYSTEM_ID,
    trigger: "manual",
    createdAt: NOW,
    ...encrypted,
  };
}

beforeEach(() => {
  fixtures.clear();
  vi.clearAllMocks();
});

// ── Query tests ─────────────────────────────────────────────────────
describe("useSnapshot", () => {
  it("returns decrypted snapshot data", async () => {
    fixtures.set("snapshot.get", makeRawSnapshot("snap_1"));
    const { result } = renderHookWithProviders(() => useSnapshot("snap_1" as SystemSnapshotId));

    let data: Awaited<ReturnType<typeof useSnapshot>>["data"] | undefined;
    await waitFor(() => {
      data = result.current.data;
      expect(data).toBeDefined();
    });
    expect(data?.content.name).toBe("Test Snapshot");
    expect(data?.content.members).toEqual([]);
    expect(data?.content.groups).toEqual([]);
    expect(data?.trigger).toBe("manual");
  });

  it("does not fetch when masterKey is null", () => {
    const { result } = renderHookWithProviders(() => useSnapshot("snap_1" as SystemSnapshotId), {
      masterKey: null,
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });

  it("select is stable across rerenders (useCallback memoization)", async () => {
    fixtures.set("snapshot.get", makeRawSnapshot("snap_1"));
    const { result, rerender } = renderHookWithProviders(() =>
      useSnapshot("snap_1" as SystemSnapshotId),
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const ref1 = result.current.data;
    rerender();
    expect(result.current.data).toBe(ref1);
  });
});

describe("useSnapshotsList", () => {
  it("returns decrypted paginated snapshots", async () => {
    const raw1 = makeRawSnapshot("snap_1");
    const raw2 = makeRawSnapshot("snap_2");
    fixtures.set("snapshot.list", { data: [raw1, raw2], nextCursor: null });

    const { result } = renderHookWithProviders(() => useSnapshotsList());

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const pages = result.current.data?.pages ?? [];
    const [firstPage] = pages;
    expect(pages).toHaveLength(1);
    expect(firstPage?.data).toHaveLength(2);
    expect(firstPage?.data[0]?.content.name).toBe("Test Snapshot");
    expect(firstPage?.data[1]?.content.name).toBe("Test Snapshot");
  });

  it("does not fetch when masterKey is null", () => {
    const { result } = renderHookWithProviders(() => useSnapshotsList(), { masterKey: null });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("select is stable across rerenders", async () => {
    fixtures.set("snapshot.list", { data: [makeRawSnapshot("snap_1")], nextCursor: null });
    const { result, rerender } = renderHookWithProviders(() => useSnapshotsList());

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const ref1 = result.current.data;
    rerender();
    expect(result.current.data).toBe(ref1);
  });
});

// ── Mutation tests ──────────────────────────────────────────────────
describe("useCreateSnapshot", () => {
  it("invalidates list on success", async () => {
    const { result } = renderHookWithProviders(() => useCreateSnapshot());

    await act(() => result.current.mutateAsync({} as never));

    await waitFor(() => {
      expect(mockUtils.snapshot.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useDeleteSnapshot", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useDeleteSnapshot());

    await act(() => result.current.mutateAsync({ snapshotId: "snap_1" } as never));

    await waitFor(() => {
      expect(mockUtils.snapshot.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        snapshotId: "snap_1",
      });
      expect(mockUtils.snapshot.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});
