// @vitest-environment happy-dom
import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderHookWithProviders, TEST_SYSTEM_ID } from "./helpers/render-hook-with-providers.js";

import type { MemberId, MemberPhotoId, UnixMillis } from "@pluralscape/types";

// ── Fixture registry (accessible from vi.mock via hoisting) ──────────
const { fixtures } = vi.hoisted(() => {
  const store = new Map<string, unknown>();
  return { fixtures: store };
});

// ── Mock utils for mutation invalidation tracking ────────────────────
const mockUtils = {
  memberPhoto: {
    get: { invalidate: vi.fn() },
    list: { invalidate: vi.fn() },
  },
};

// ── tRPC mock backed by real React Query ─────────────────────────────
vi.mock("@pluralscape/api-client/trpc", async () => {
  const rq = await import("@tanstack/react-query");

  return {
    trpc: {
      memberPhoto: {
        get: {
          useQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
            rq.useQuery({
              queryKey: ["memberPhoto.get", input],
              queryFn: () => Promise.resolve(fixtures.get("memberPhoto.get")),
              enabled: opts.enabled as boolean | undefined,
              select: opts.select as ((d: unknown) => unknown) | undefined,
            }),
        },
        list: {
          useInfiniteQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
            rq.useInfiniteQuery({
              queryKey: ["memberPhoto.list", input],
              queryFn: () => Promise.resolve(fixtures.get("memberPhoto.list")),
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
        delete: {
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
  useMemberPhoto,
  useMemberPhotosList,
  useCreateMemberPhoto,
  useArchiveMemberPhoto,
  useRestoreMemberPhoto,
  useDeleteMemberPhoto,
  useReorderMemberPhotos,
} = await import("../use-member-photos.js");

// ── Fixtures ─────────────────────────────────────────────────────────
const NOW = 1_700_000_000_000 as UnixMillis;
const TEST_MEMBER_ID = "mem_test_member_1" as MemberId;

function makeMemberPhoto(id: string) {
  return {
    id: id as MemberPhotoId,
    memberId: TEST_MEMBER_ID,
    systemId: TEST_SYSTEM_ID,
    sortOrder: 0,
    encryptedData: "base64_encrypted_photo_data",
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    archived: false,
    archivedAt: null,
  };
}

beforeEach(() => {
  fixtures.clear();
  vi.clearAllMocks();
});

// ── Member photo query tests ──────────────────────────────────────────
describe("useMemberPhoto", () => {
  it("returns member photo data", async () => {
    fixtures.set("memberPhoto.get", makeMemberPhoto("mp_1"));
    const { result } = renderHookWithProviders(() =>
      useMemberPhoto("mp_1" as MemberPhotoId, { memberId: TEST_MEMBER_ID }),
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data?.id).toBe("mp_1");
    expect(result.current.data?.memberId).toBe(TEST_MEMBER_ID);
    expect(result.current.data?.encryptedData).toBe("base64_encrypted_photo_data");
  });
});

describe("useMemberPhotosList", () => {
  it("returns paginated member photos", async () => {
    const p1 = makeMemberPhoto("mp_1");
    const p2 = makeMemberPhoto("mp_2");
    fixtures.set("memberPhoto.list", { data: [p1, p2], nextCursor: null });

    const { result } = renderHookWithProviders(() =>
      useMemberPhotosList({ memberId: TEST_MEMBER_ID }),
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const data = result.current.data;
    const pages = data && "pages" in data ? data.pages : [];
    const [firstPage] = pages;
    const items = firstPage && "data" in firstPage ? firstPage.data : [];
    expect(pages).toHaveLength(1);
    expect(items).toHaveLength(2);
    expect(items[0]?.id).toBe("mp_1");
    expect(items[1]?.id).toBe("mp_2");
  });
});

// ── Member photo mutation tests ───────────────────────────────────────
describe("useCreateMemberPhoto", () => {
  it("invalidates list on success", async () => {
    const { result } = renderHookWithProviders(() => useCreateMemberPhoto());

    await act(() => result.current.mutateAsync({ memberId: TEST_MEMBER_ID } as never));

    await waitFor(() => {
      expect(mockUtils.memberPhoto.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        memberId: TEST_MEMBER_ID,
      });
    });
  });
});

describe("useArchiveMemberPhoto", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useArchiveMemberPhoto());

    await act(() =>
      result.current.mutateAsync({ memberId: TEST_MEMBER_ID, photoId: "mp_1" } as never),
    );

    await waitFor(() => {
      expect(mockUtils.memberPhoto.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        memberId: TEST_MEMBER_ID,
        photoId: "mp_1",
      });
      expect(mockUtils.memberPhoto.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        memberId: TEST_MEMBER_ID,
      });
    });
  });
});

describe("useRestoreMemberPhoto", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useRestoreMemberPhoto());

    await act(() =>
      result.current.mutateAsync({ memberId: TEST_MEMBER_ID, photoId: "mp_2" } as never),
    );

    await waitFor(() => {
      expect(mockUtils.memberPhoto.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        memberId: TEST_MEMBER_ID,
        photoId: "mp_2",
      });
      expect(mockUtils.memberPhoto.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        memberId: TEST_MEMBER_ID,
      });
    });
  });
});

describe("useDeleteMemberPhoto", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useDeleteMemberPhoto());

    await act(() =>
      result.current.mutateAsync({ memberId: TEST_MEMBER_ID, photoId: "mp_3" } as never),
    );

    await waitFor(() => {
      expect(mockUtils.memberPhoto.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        memberId: TEST_MEMBER_ID,
        photoId: "mp_3",
      });
      expect(mockUtils.memberPhoto.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        memberId: TEST_MEMBER_ID,
      });
    });
  });
});

describe("useReorderMemberPhotos", () => {
  it("invalidates list on success", async () => {
    const { result } = renderHookWithProviders(() => useReorderMemberPhotos());

    await act(() => result.current.mutateAsync({ memberId: TEST_MEMBER_ID } as never));

    await waitFor(() => {
      expect(mockUtils.memberPhoto.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        memberId: TEST_MEMBER_ID,
      });
    });
  });
});
