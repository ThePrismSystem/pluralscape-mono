// @vitest-environment happy-dom
import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { encryptMemberInput } from "@pluralscape/data/transforms/member";
import { act, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  renderHookWithProviders,
  TEST_MASTER_KEY,
  TEST_SYSTEM_ID,
} from "./helpers/render-hook-with-providers.js";

import type { MemberRaw } from "@pluralscape/data/transforms/member";
import type { MemberId, UnixMillis } from "@pluralscape/types";

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
  member: {
    get: { invalidate: vi.fn() },
    list: { invalidate: vi.fn() },
    listMemberships: { invalidate: vi.fn() },
  },
};

// ── tRPC mock backed by real React Query ─────────────────────────────
vi.mock("@pluralscape/api-client/trpc", async () => {
  const rq = await import("@tanstack/react-query");

  return {
    trpc: {
      member: {
        get: {
          useQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
            rq.useQuery({
              queryKey: ["member.get", input],
              queryFn: () => Promise.resolve(fixtures.get("member.get")),
              enabled: opts.enabled as boolean | undefined,
              select: opts.select as ((d: unknown) => unknown) | undefined,
            }),
        },
        list: {
          useInfiniteQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
            rq.useInfiniteQuery({
              queryKey: ["member.list", input],
              queryFn: () => Promise.resolve(fixtures.get("member.list")),
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
        archive: {
          useMutation: (opts: Record<string, unknown> = {}) =>
            rq.useMutation({
              mutationFn: () => Promise.resolve({}),
              onSuccess: opts.onSuccess as
                | ((data: unknown, variables: unknown) => void)
                | undefined,
            }),
        },
        restore: {
          useMutation: (opts: Record<string, unknown> = {}) =>
            rq.useMutation({
              mutationFn: () => Promise.resolve({}),
              onSuccess: opts.onSuccess as
                | ((data: unknown, variables: unknown) => void)
                | undefined,
            }),
        },
        duplicate: {
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
  useMember,
  useMembersList,
  useCreateMember,
  useUpdateMember,
  useArchiveMember,
  useRestoreMember,
  useDuplicateMember,
} = await import("../use-members.js");

// ── Fixtures ─────────────────────────────────────────────────────────
const NOW = 1_700_000_000_000 as UnixMillis;

function makeRawMember(id: string): MemberRaw {
  const encrypted = encryptMemberInput(
    {
      name: `Member ${id}`,
      pronouns: ["they/them"],
      description: "A test member",
      avatarSource: null,
      colors: [],
      saturationLevel: { kind: "known", level: "highly-elaborated" },
      tags: [],
      suppressFriendFrontNotification: false,
      boardMessageNotificationOnFront: false,
    },
    TEST_MASTER_KEY,
  );
  return {
    id: id as MemberId,
    systemId: TEST_SYSTEM_ID,
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
});

// ── Query tests ─────────────────────────────────────────────────────
describe("useMember", () => {
  it("returns decrypted member data", async () => {
    fixtures.set("member.get", makeRawMember("m-1"));
    const { result } = renderHookWithProviders(() => useMember("m-1" as MemberId));

    let data: Awaited<ReturnType<typeof useMember>>["data"] | undefined;
    await waitFor(() => {
      data = result.current.data;
      expect(data).toBeDefined();
    });
    expect(data?.name).toBe("Member m-1");
    expect(data?.pronouns).toEqual(["they/them"]);
    expect(data?.description).toBe("A test member");
    expect(data?.archived).toBe(false);
  });

  it("does not fetch when masterKey is null", () => {
    const { result } = renderHookWithProviders(() => useMember("m-1" as MemberId), {
      masterKey: null,
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });

  it("select is stable across rerenders (useCallback memoization)", async () => {
    fixtures.set("member.get", makeRawMember("m-1"));
    const { result, rerender } = renderHookWithProviders(() => useMember("m-1" as MemberId));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const ref1 = result.current.data;
    rerender();
    expect(result.current.data).toBe(ref1);
  });
});

describe("useMembersList", () => {
  it("returns decrypted paginated members", async () => {
    const raw1 = makeRawMember("m-1");
    const raw2 = makeRawMember("m-2");
    fixtures.set("member.list", { data: [raw1, raw2], nextCursor: null });

    const { result } = renderHookWithProviders(() => useMembersList());

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const pages = result.current.data?.pages ?? [];
    const [firstPage] = pages;
    const [item0, item1] = firstPage?.data ?? [];
    expect(pages).toHaveLength(1);
    expect(firstPage?.data).toHaveLength(2);
    expect(item0?.name).toBe("Member m-1");
    expect(item1?.name).toBe("Member m-2");
  });

  it("does not fetch when masterKey is null", () => {
    const { result } = renderHookWithProviders(() => useMembersList(), { masterKey: null });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("select is stable across rerenders", async () => {
    fixtures.set("member.list", { data: [makeRawMember("m-1")], nextCursor: null });
    const { result, rerender } = renderHookWithProviders(() => useMembersList());

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const ref1 = result.current.data;
    rerender();
    expect(result.current.data).toBe(ref1);
  });
});

// ── Mutation tests ──────────────────────────────────────────────────
describe("useCreateMember", () => {
  it("invalidates list on success", async () => {
    const { result } = renderHookWithProviders(() => useCreateMember());

    await act(() => result.current.mutateAsync({} as never));

    await waitFor(() => {
      expect(mockUtils.member.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useUpdateMember", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useUpdateMember());

    await act(() => result.current.mutateAsync({ memberId: "m-1" } as never));

    await waitFor(() => {
      expect(mockUtils.member.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        memberId: "m-1",
      });
      expect(mockUtils.member.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useArchiveMember", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useArchiveMember());

    await act(() => result.current.mutateAsync({ memberId: "m-2" } as never));

    await waitFor(() => {
      expect(mockUtils.member.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        memberId: "m-2",
      });
      expect(mockUtils.member.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useRestoreMember", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useRestoreMember());

    await act(() => result.current.mutateAsync({ memberId: "m-3" } as never));

    await waitFor(() => {
      expect(mockUtils.member.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        memberId: "m-3",
      });
      expect(mockUtils.member.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useDuplicateMember", () => {
  it("invalidates list on success", async () => {
    const { result } = renderHookWithProviders(() => useDuplicateMember());

    await act(() => result.current.mutateAsync({} as never));

    await waitFor(() => {
      expect(mockUtils.member.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});
