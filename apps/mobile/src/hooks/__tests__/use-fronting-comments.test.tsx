// @vitest-environment happy-dom
import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { encryptFrontingCommentInput } from "@pluralscape/data/transforms/fronting-comment";
import { brandId } from "@pluralscape/types";
import { act, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  renderHookWithProviders,
  TEST_MASTER_KEY,
  TEST_SYSTEM_ID,
} from "./helpers/render-hook-with-providers.js";

import type { FrontingCommentRaw } from "@pluralscape/data/transforms/fronting-comment";
import type {
  FrontingCommentId,
  FrontingSessionId,
  MemberId,
  UnixMillis,
} from "@pluralscape/types";

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
  frontingComment: {
    get: { invalidate: vi.fn() },
    list: { invalidate: vi.fn() },
  },
};

// ── tRPC mock backed by real React Query ─────────────────────────────
vi.mock("@pluralscape/api-client/trpc", async () => {
  const rq = await import("@tanstack/react-query");

  return {
    trpc: {
      frontingComment: {
        get: {
          useQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
            rq.useQuery({
              queryKey: ["frontingComment.get", input],
              queryFn: () => Promise.resolve(fixtures.get("frontingComment.get")),
              enabled: opts.enabled as boolean | undefined,
              select: opts.select as ((d: unknown) => unknown) | undefined,
            }),
        },
        list: {
          useInfiniteQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
            rq.useInfiniteQuery({
              queryKey: ["frontingComment.list", input],
              queryFn: () => Promise.resolve(fixtures.get("frontingComment.list")),
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
      useUtils: () => mockUtils,
    },
  };
});

// Must import AFTER vi.mock
const {
  useFrontingComment,
  useFrontingCommentsList,
  useCreateComment,
  useUpdateComment,
  useDeleteComment,
} = await import("../use-fronting-comments.js");

// ── Fixtures ─────────────────────────────────────────────────────────
const NOW = 1_700_000_000_000 as UnixMillis;
const SESSION_ID = brandId<FrontingSessionId>("fs-1");

function makeRawComment(id: string): FrontingCommentRaw {
  const encrypted = encryptFrontingCommentInput({ content: `Comment ${id}` }, TEST_MASTER_KEY);
  return {
    id: brandId<FrontingCommentId>(id),
    frontingSessionId: SESSION_ID,
    systemId: TEST_SYSTEM_ID,
    memberId: brandId<MemberId>("m-1"),
    customFrontId: null,
    structureEntityId: null,
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

// ── Query tests ──────────────────────────────────────────────────────
describe("useFrontingComment", () => {
  it("returns decrypted comment data", async () => {
    fixtures.set("frontingComment.get", makeRawComment("fc-1"));
    const { result } = renderHookWithProviders(() =>
      useFrontingComment(brandId<FrontingCommentId>("fc-1"), SESSION_ID),
    );

    let data: Awaited<ReturnType<typeof useFrontingComment>>["data"] | undefined;
    await waitFor(() => {
      data = result.current.data;
      expect(result.current.isSuccess).toBe(true);
    });
    expect(data?.content).toBe("Comment fc-1");
    expect(data?.frontingSessionId).toBe(SESSION_ID);
    expect(data?.archived).toBe(false);
  });

  it("does not fetch when masterKey is null", () => {
    const { result } = renderHookWithProviders(
      () => useFrontingComment(brandId<FrontingCommentId>("fc-1"), SESSION_ID),
      { masterKey: null },
    );
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });

  it("select is stable across rerenders (useCallback memoization)", async () => {
    fixtures.set("frontingComment.get", makeRawComment("fc-1"));
    const { result, rerender } = renderHookWithProviders(() =>
      useFrontingComment(brandId<FrontingCommentId>("fc-1"), SESSION_ID),
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const ref1 = result.current.data;
    rerender();
    expect(result.current.data).toBe(ref1);
  });
});

describe("useFrontingCommentsList", () => {
  it("returns decrypted paginated comments", async () => {
    const raw1 = makeRawComment("fc-1");
    const raw2 = makeRawComment("fc-2");
    fixtures.set("frontingComment.list", { data: [raw1, raw2], nextCursor: null });

    const { result } = renderHookWithProviders(() => useFrontingCommentsList(SESSION_ID));

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const data = result.current.data;
    const pages = data && "pages" in data ? data.pages : [];
    expect(pages).toHaveLength(1);
    expect(pages[0]?.data).toHaveLength(2);
    expect(pages[0]?.data[0]?.content).toBe("Comment fc-1");
    expect(pages[0]?.data[1]?.content).toBe("Comment fc-2");
  });

  it("does not fetch when masterKey is null", () => {
    const { result } = renderHookWithProviders(() => useFrontingCommentsList(SESSION_ID), {
      masterKey: null,
    });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("select is stable across rerenders", async () => {
    fixtures.set("frontingComment.list", { data: [makeRawComment("fc-1")], nextCursor: null });
    const { result, rerender } = renderHookWithProviders(() => useFrontingCommentsList(SESSION_ID));

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const ref1 = result.current.data;
    rerender();
    expect(result.current.data).toBe(ref1);
  });
});

// ── Mutation tests ────────────────────────────────────────────────────
describe("useCreateComment", () => {
  it("invalidates list on success", async () => {
    const { result } = renderHookWithProviders(() => useCreateComment());

    await act(() => result.current.mutateAsync({ sessionId: SESSION_ID } as never));

    await waitFor(() => {
      expect(mockUtils.frontingComment.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        sessionId: SESSION_ID,
      });
    });
  });
});

describe("useUpdateComment", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useUpdateComment());

    await act(() =>
      result.current.mutateAsync({
        commentId: brandId<FrontingCommentId>("fc-1"),
        sessionId: SESSION_ID,
      } as never),
    );

    await waitFor(() => {
      expect(mockUtils.frontingComment.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        sessionId: SESSION_ID,
        commentId: "fc-1",
      });
      expect(mockUtils.frontingComment.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        sessionId: SESSION_ID,
      });
    });
  });
});

describe("useDeleteComment", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useDeleteComment());

    await act(() =>
      result.current.mutateAsync({
        commentId: brandId<FrontingCommentId>("fc-2"),
        sessionId: SESSION_ID,
      } as never),
    );

    await waitFor(() => {
      expect(mockUtils.frontingComment.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        sessionId: SESSION_ID,
        commentId: "fc-2",
      });
      expect(mockUtils.frontingComment.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        sessionId: SESSION_ID,
      });
    });
  });
});
