// @vitest-environment happy-dom
import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { encryptMemberInput } from "@pluralscape/data/transforms/member";
import { brandId } from "@pluralscape/types";
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
    id: brandId<MemberId>(id),
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
    const { result } = renderHookWithProviders(() => useMember(brandId<MemberId>("m-1")));

    let data: Awaited<ReturnType<typeof useMember>>["data"] | undefined;
    await waitFor(() => {
      data = result.current.data;
      expect(result.current.isSuccess).toBe(true);
    });
    expect(data?.name).toBe("Member m-1");
    expect(data?.pronouns).toEqual(["they/them"]);
    expect(data?.description).toBe("A test member");
    expect(data?.archived).toBe(false);
  });

  it("does not fetch when masterKey is null", () => {
    const { result } = renderHookWithProviders(() => useMember(brandId<MemberId>("m-1")), {
      masterKey: null,
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });

  it("select is stable across rerenders (useCallback memoization)", async () => {
    fixtures.set("member.get", makeRawMember("m-1"));
    const { result, rerender } = renderHookWithProviders(() => useMember(brandId<MemberId>("m-1")));

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
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
      expect(result.current.isSuccess).toBe(true);
    });
    const data = result.current.data;
    const pages = data && "pages" in data ? data.pages : [];
    const [firstPage] = pages;
    const items = firstPage && "data" in firstPage ? firstPage.data : [];
    expect(pages).toHaveLength(1);
    expect(items).toHaveLength(2);
    expect(items[0]?.name).toBe("Member m-1");
    expect(items[1]?.name).toBe("Member m-2");
  });

  it("does not fetch when masterKey is null", () => {
    const { result } = renderHookWithProviders(() => useMembersList(), { masterKey: null });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("select is stable across rerenders", async () => {
    fixtures.set("member.list", { data: [makeRawMember("m-1")], nextCursor: null });
    const { result, rerender } = renderHookWithProviders(() => useMembersList());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
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

const LOCAL_MEMBER_ROW: Record<string, unknown> = {
  id: "m-local-1",
  system_id: TEST_SYSTEM_ID,
  name: "Local Member",
  pronouns: '["she/her"]',
  description: "From SQLite",
  avatar_source: null,
  colors: "[]",
  saturation_level: '{"kind":"known","level":"highly-elaborated"}',
  tags: "[]",
  suppress_friend_front_notification: 0,
  board_message_notification_on_front: 1,
  archived: 0,
  created_at: 1_700_000_000_000,
  updated_at: 1_700_000_000_000,
};

describe("useMember (local source)", () => {
  it("returns transformed local row data", async () => {
    const localDb = createMockLocalDb([LOCAL_MEMBER_ROW]);
    const { result } = renderHookWithProviders(() => useMember(brandId<MemberId>("m-local-1")), {
      querySource: "local",
      localDb,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(localDb.queryOne).toHaveBeenCalledWith(expect.stringContaining("members"), [
      "m-local-1",
    ]);
    expect(result.current.data).toMatchObject({
      id: "m-local-1",
      name: "Local Member",
      pronouns: ["she/her"],
      description: "From SQLite",
      archived: false,
      boardMessageNotificationOnFront: true,
    });
  });

  it("does not call tRPC in local mode", async () => {
    const localDb = createMockLocalDb([LOCAL_MEMBER_ROW]);
    const { result } = renderHookWithProviders(() => useMember(brandId<MemberId>("m-local-1")), {
      querySource: "local",
      localDb,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // The tRPC mock is backed by fixtures — if fixture is unset, data would
    // be undefined. Local mode should have data without setting a fixture.
    expect(result.current.data?.name).toBe("Local Member");
  });
});

describe("useMembersList (local source)", () => {
  it("returns flat array of transformed rows", async () => {
    const row2 = { ...LOCAL_MEMBER_ROW, id: "m-local-2", name: "Second Member" };
    const localDb = createMockLocalDb([LOCAL_MEMBER_ROW, row2]);
    const { result } = renderHookWithProviders(() => useMembersList(), {
      querySource: "local",
      localDb,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(localDb.queryAll).toHaveBeenCalledWith(
      expect.stringContaining("members"),
      expect.arrayContaining([TEST_SYSTEM_ID]),
    );

    const data = result.current.data;
    const pages = data && "pages" in data ? data.pages : [];
    expect(pages).toHaveLength(1);
    const items = pages[0] && "data" in pages[0] ? pages[0].data : [];
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ name: "Local Member" });
    expect(items[1]).toMatchObject({ name: "Second Member" });
  });

  it("does not require masterKey in local mode", async () => {
    const localDb = createMockLocalDb([LOCAL_MEMBER_ROW]);
    const { result } = renderHookWithProviders(() => useMembersList(), {
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
