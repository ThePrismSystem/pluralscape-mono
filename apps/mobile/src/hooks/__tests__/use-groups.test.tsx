// @vitest-environment happy-dom
import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { brandId } from "@pluralscape/types";
import { act, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { makeRawGroup } from "../../__tests__/factories/index.js";

import { renderHookWithProviders, TEST_SYSTEM_ID } from "./helpers/render-hook-with-providers.js";

import type { GroupId } from "@pluralscape/types";

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
  group: {
    get: { invalidate: vi.fn() },
    list: { invalidate: vi.fn() },
    listMembers: { invalidate: vi.fn() },
  },
  member: {
    listMemberships: { invalidate: vi.fn() },
  },
};

// ── tRPC mock backed by real React Query ─────────────────────────────
vi.mock("@pluralscape/api-client/trpc", async () => {
  const rq = await import("@tanstack/react-query");

  return {
    trpc: {
      group: {
        get: {
          useQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
            rq.useQuery({
              queryKey: ["group.get", input],
              queryFn: () => Promise.resolve(fixtures.get("group.get")),
              enabled: opts.enabled as boolean | undefined,
              select: opts.select as ((d: unknown) => unknown) | undefined,
            }),
        },
        list: {
          useInfiniteQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
            rq.useInfiniteQuery({
              queryKey: ["group.list", input],
              queryFn: () => Promise.resolve(fixtures.get("group.list")),
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
        addMember: {
          useMutation: (opts: Record<string, unknown> = {}) =>
            rq.useMutation({
              mutationFn: () => Promise.resolve({}),
              onSuccess: opts.onSuccess as
                | ((data: unknown, variables: unknown) => void)
                | undefined,
            }),
        },
        removeMember: {
          useMutation: (opts: Record<string, unknown> = {}) =>
            rq.useMutation({
              mutationFn: () => Promise.resolve({}),
              onSuccess: opts.onSuccess as
                | ((data: unknown, variables: unknown) => void)
                | undefined,
            }),
        },
        reorder: {
          useMutation: (opts: Record<string, unknown> = {}) =>
            rq.useMutation({
              mutationFn: () => Promise.resolve({}),
              onSuccess: opts.onSuccess as (() => void) | undefined,
            }),
        },
      },
      useUtils: () => mockUtils,
    },
  };
});

// Must import AFTER vi.mock
const {
  useGroup,
  useGroupsList,
  useCreateGroup,
  useUpdateGroup,
  useDeleteGroup,
  useAddGroupMembers,
  useRemoveGroupMembers,
  useReorderGroups,
} = await import("../use-groups.js");

beforeEach(() => {
  fixtures.clear();
  vi.clearAllMocks();
});

// ── Query tests ─────────────────────────────────────────────────────
describe("useGroup", () => {
  it("returns decrypted group data", async () => {
    fixtures.set("group.get", makeRawGroup("g-1"));
    const { result } = renderHookWithProviders(() => useGroup(brandId<GroupId>("g-1")));

    let data: Awaited<ReturnType<typeof useGroup>>["data"] | undefined;
    await waitFor(() => {
      data = result.current.data;
      expect(result.current.isSuccess).toBe(true);
    });
    expect(data?.name).toBe("Group g-1");
    expect(data?.description).toBe("A test group");
    expect(data?.archived).toBe(false);
  });

  it("does not fetch when masterKey is null", () => {
    const { result } = renderHookWithProviders(() => useGroup(brandId<GroupId>("g-1")), {
      masterKey: null,
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });

  it("select is stable across rerenders (useCallback memoization)", async () => {
    fixtures.set("group.get", makeRawGroup("g-1"));
    const { result, rerender } = renderHookWithProviders(() => useGroup(brandId<GroupId>("g-1")));

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const ref1 = result.current.data;
    rerender();
    expect(result.current.data).toBe(ref1);
  });
});

describe("useGroupsList", () => {
  it("returns decrypted paginated groups", async () => {
    const raw1 = makeRawGroup("g-1");
    const raw2 = makeRawGroup("g-2");
    fixtures.set("group.list", { data: [raw1, raw2], nextCursor: null });

    const { result } = renderHookWithProviders(() => useGroupsList());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const data = result.current.data;
    const pages = data && "pages" in data ? data.pages : [];
    expect(pages).toHaveLength(1);
    const items = pages[0] && "data" in pages[0] ? pages[0].data : [];
    expect(items).toHaveLength(2);
    expect(items[0]?.name).toBe("Group g-1");
    expect(items[1]?.name).toBe("Group g-2");
  });

  it("does not fetch when masterKey is null", () => {
    const { result } = renderHookWithProviders(() => useGroupsList(), { masterKey: null });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("select is stable across rerenders", async () => {
    fixtures.set("group.list", { data: [makeRawGroup("g-1")], nextCursor: null });
    const { result, rerender } = renderHookWithProviders(() => useGroupsList());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const ref1 = result.current.data;
    rerender();
    expect(result.current.data).toBe(ref1);
  });
});

// ── Mutation tests ──────────────────────────────────────────────────
describe("useCreateGroup", () => {
  it("invalidates list on success", async () => {
    const { result } = renderHookWithProviders(() => useCreateGroup());

    await act(() => result.current.mutateAsync({} as never));

    await waitFor(() => {
      expect(mockUtils.group.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useUpdateGroup", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useUpdateGroup());

    await act(() => result.current.mutateAsync({ groupId: "g-1" } as never));

    await waitFor(() => {
      expect(mockUtils.group.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        groupId: "g-1",
      });
      expect(mockUtils.group.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useDeleteGroup", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useDeleteGroup());

    await act(() => result.current.mutateAsync({ groupId: "g-2" } as never));

    await waitFor(() => {
      expect(mockUtils.group.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        groupId: "g-2",
      });
      expect(mockUtils.group.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useAddGroupMembers", () => {
  it("invalidates listMembers and listMemberships on success", async () => {
    const { result } = renderHookWithProviders(() => useAddGroupMembers());

    await act(() => result.current.mutateAsync({ groupId: "g-1", memberId: "m-1" } as never));

    await waitFor(() => {
      expect(mockUtils.group.listMembers.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        groupId: "g-1",
      });
      expect(mockUtils.member.listMemberships.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        memberId: "m-1",
      });
    });
  });
});

describe("useRemoveGroupMembers", () => {
  it("invalidates listMembers and listMemberships on success", async () => {
    const { result } = renderHookWithProviders(() => useRemoveGroupMembers());

    await act(() => result.current.mutateAsync({ groupId: "g-2", memberId: "m-2" } as never));

    await waitFor(() => {
      expect(mockUtils.group.listMembers.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        groupId: "g-2",
      });
      expect(mockUtils.member.listMemberships.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        memberId: "m-2",
      });
    });
  });
});

describe("useReorderGroups", () => {
  it("invalidates list on success", async () => {
    const { result } = renderHookWithProviders(() => useReorderGroups());

    await act(() => result.current.mutateAsync({} as never));

    await waitFor(() => {
      expect(mockUtils.group.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});
