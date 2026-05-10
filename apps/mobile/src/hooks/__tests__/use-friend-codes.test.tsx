// @vitest-environment happy-dom
import { brandId } from "@pluralscape/types";
import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderHookWithProviders } from "./helpers/render-hook-with-providers.js";

import type { FriendCodeId } from "@pluralscape/types";

type CapturedOpts = Record<string, unknown>;
let lastListOpts: CapturedOpts = {};

const mockUtils = {
  friendCode: {
    list: { invalidate: vi.fn() },
  },
  friend: {
    list: { invalidate: vi.fn() },
  },
};

vi.mock("@pluralscape/api-client/trpc", async () => {
  const rq = await import("@tanstack/react-query");

  const makeMutation = (opts: Record<string, unknown> = {}) =>
    rq.useMutation({
      mutationFn: () => Promise.resolve({}),
      onSuccess: opts.onSuccess as (() => void) | undefined,
    });

  return {
    trpc: {
      friendCode: {
        list: {
          useInfiniteQuery: (_input: unknown, opts: CapturedOpts = {}) => {
            lastListOpts = opts;
            return { data: undefined, isLoading: true };
          },
        },
        generate: { useMutation: makeMutation },
        redeem: { useMutation: makeMutation },
        archive: { useMutation: makeMutation },
      },
      useUtils: () => mockUtils,
    },
  };
});

const { useFriendCodesList, useGenerateFriendCode, useRedeemFriendCode, useArchiveFriendCode } =
  await import("../use-friend-codes.js");

beforeEach(() => {
  lastListOpts = {};
  vi.clearAllMocks();
});

describe("useFriendCodesList", () => {
  it("is enabled in remote mode without requiring a masterKey", () => {
    renderHookWithProviders(() => useFriendCodesList(), { querySource: "remote" });
    expect(lastListOpts["enabled"]).toBe(true);
  });

  it("passes getNextPageParam", () => {
    renderHookWithProviders(() => useFriendCodesList());
    expect(lastListOpts["getNextPageParam"]).toBeTypeOf("function");
  });
});

describe("useGenerateFriendCode", () => {
  it("invalidates friendCode list on success", async () => {
    const { result } = renderHookWithProviders(() => useGenerateFriendCode());

    await act(() =>
      result.current.mutateAsync(undefined as Parameters<typeof result.current.mutateAsync>[0]),
    );

    await waitFor(() => {
      expect(mockUtils.friendCode.list.invalidate).toHaveBeenCalled();
    });
  });
});

describe("useRedeemFriendCode", () => {
  it("invalidates friendCode list and friend list on success", async () => {
    const { result } = renderHookWithProviders(() => useRedeemFriendCode());

    await act(() =>
      result.current.mutateAsync({
        code: "ABCD1234",
      }),
    );

    await waitFor(() => {
      expect(mockUtils.friendCode.list.invalidate).toHaveBeenCalled();
      expect(mockUtils.friend.list.invalidate).toHaveBeenCalled();
    });
  });
});

describe("useArchiveFriendCode", () => {
  it("invalidates friendCode list on success", async () => {
    const { result } = renderHookWithProviders(() => useArchiveFriendCode());

    await act(() =>
      result.current.mutateAsync({
        codeId: brandId<FriendCodeId>("frc_test"),
      }),
    );

    await waitFor(() => {
      expect(mockUtils.friendCode.list.invalidate).toHaveBeenCalled();
    });
  });
});
