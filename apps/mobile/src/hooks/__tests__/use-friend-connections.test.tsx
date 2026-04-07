// @vitest-environment happy-dom
import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderHookWithProviders } from "./helpers/render-hook-with-providers.js";

type CapturedOpts = Record<string, unknown>;
let lastListOpts: CapturedOpts = {};
let lastGetInput: Record<string, unknown> = {};

const mockUtils = {
  friend: {
    get: { invalidate: vi.fn() },
    list: { invalidate: vi.fn() },
  },
};

let lastNotifInput: Record<string, unknown> = {};
let lastNotifOpts: CapturedOpts = {};
let lastListReceivedKeyGrantsOpts: CapturedOpts = {};

vi.mock("@pluralscape/api-client/trpc", async () => {
  const rq = await import("@tanstack/react-query");

  const makeMutation = (opts: Record<string, unknown> = {}) =>
    rq.useMutation({
      mutationFn: () => Promise.resolve({}),
      onSuccess: opts.onSuccess as (() => void) | undefined,
    });

  return {
    trpc: {
      friend: {
        get: {
          useQuery: (input: Record<string, unknown>) => {
            lastGetInput = input;
            return { data: undefined, isLoading: true };
          },
        },
        list: {
          useInfiniteQuery: (_input: unknown, opts: CapturedOpts = {}) => {
            lastListOpts = opts;
            return { data: undefined, isLoading: true };
          },
        },
        accept: { useMutation: makeMutation },
        reject: { useMutation: makeMutation },
        block: { useMutation: makeMutation },
        remove: { useMutation: makeMutation },
        archive: { useMutation: makeMutation },
        restore: { useMutation: makeMutation },
        updateVisibility: { useMutation: makeMutation },
        getNotifications: {
          useQuery: (input: Record<string, unknown>, opts: CapturedOpts = {}) => {
            lastNotifInput = input;
            lastNotifOpts = opts;
            return { data: undefined, isLoading: true };
          },
          invalidate: vi.fn(),
        },
        updateNotifications: { useMutation: makeMutation },
        listReceivedKeyGrants: {
          useQuery: (_input: unknown, opts: CapturedOpts = {}) => {
            lastListReceivedKeyGrantsOpts = opts;
            return { data: undefined, isLoading: true };
          },
        },
      },
      useUtils: () => ({
        ...mockUtils,
        friend: {
          ...mockUtils.friend,
          getNotifications: { invalidate: vi.fn() },
        },
      }),
    },
  };
});

const {
  useFriendConnection,
  useFriendConnectionsList,
  useAcceptFriendConnection,
  useRejectFriendConnection,
  useBlockFriendConnection,
  useRemoveFriendConnection,
  useArchiveFriendConnection,
  useRestoreFriendConnection,
  useUpdateFriendVisibility,
  useFriendNotificationPrefs,
  useUpdateFriendNotificationPrefs,
  useListReceivedKeyGrants,
} = await import("../use-friend-connections.js");

beforeEach(() => {
  lastListOpts = {};
  lastGetInput = {};
  vi.clearAllMocks();
});

describe("useFriendConnection", () => {
  it("passes connectionId to query", () => {
    renderHookWithProviders(() => useFriendConnection("fc_test" as never));
    expect(lastGetInput["connectionId"]).toBe("fc_test");
  });
});

describe("useFriendConnectionsList", () => {
  it("is enabled in remote mode without requiring a masterKey", () => {
    renderHookWithProviders(() => useFriendConnectionsList(), { querySource: "remote" });
    expect(lastListOpts["enabled"]).toBe(true);
  });

  it("passes getNextPageParam", () => {
    renderHookWithProviders(() => useFriendConnectionsList());
    expect(lastListOpts["getNextPageParam"]).toBeTypeOf("function");
  });
});

describe("useAcceptFriendConnection", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useAcceptFriendConnection());

    await act(() => result.current.mutateAsync({ connectionId: "fc_test" } as never));

    await waitFor(() => {
      expect(mockUtils.friend.get.invalidate).toHaveBeenCalledWith({ connectionId: "fc_test" });
      expect(mockUtils.friend.list.invalidate).toHaveBeenCalled();
    });
  });
});

describe("useRejectFriendConnection", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useRejectFriendConnection());

    await act(() => result.current.mutateAsync({ connectionId: "fc_test" } as never));

    await waitFor(() => {
      expect(mockUtils.friend.get.invalidate).toHaveBeenCalledWith({ connectionId: "fc_test" });
      expect(mockUtils.friend.list.invalidate).toHaveBeenCalled();
    });
  });
});

describe("useBlockFriendConnection", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useBlockFriendConnection());

    await act(() => result.current.mutateAsync({ connectionId: "fc_test" } as never));

    await waitFor(() => {
      expect(mockUtils.friend.get.invalidate).toHaveBeenCalledWith({ connectionId: "fc_test" });
      expect(mockUtils.friend.list.invalidate).toHaveBeenCalled();
    });
  });
});

describe("useRemoveFriendConnection", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useRemoveFriendConnection());

    await act(() => result.current.mutateAsync({ connectionId: "fc_test" } as never));

    await waitFor(() => {
      expect(mockUtils.friend.get.invalidate).toHaveBeenCalledWith({ connectionId: "fc_test" });
      expect(mockUtils.friend.list.invalidate).toHaveBeenCalled();
    });
  });
});

describe("useArchiveFriendConnection", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useArchiveFriendConnection());

    await act(() => result.current.mutateAsync({ connectionId: "fc_test" } as never));

    await waitFor(() => {
      expect(mockUtils.friend.get.invalidate).toHaveBeenCalledWith({ connectionId: "fc_test" });
      expect(mockUtils.friend.list.invalidate).toHaveBeenCalled();
    });
  });
});

describe("useRestoreFriendConnection", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useRestoreFriendConnection());

    await act(() => result.current.mutateAsync({ connectionId: "fc_test" } as never));

    await waitFor(() => {
      expect(mockUtils.friend.get.invalidate).toHaveBeenCalledWith({ connectionId: "fc_test" });
      expect(mockUtils.friend.list.invalidate).toHaveBeenCalled();
    });
  });
});

describe("useUpdateFriendVisibility", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useUpdateFriendVisibility());

    await act(() => result.current.mutateAsync({ connectionId: "fc_test" } as never));

    await waitFor(() => {
      expect(mockUtils.friend.get.invalidate).toHaveBeenCalledWith({ connectionId: "fc_test" });
      expect(mockUtils.friend.list.invalidate).toHaveBeenCalled();
    });
  });
});

describe("useFriendNotificationPrefs", () => {
  it("forwards connectionId to the underlying tRPC query", () => {
    renderHookWithProviders(() => useFriendNotificationPrefs("fc_notif" as never), {
      querySource: "remote",
    });
    expect(lastNotifInput["connectionId"]).toBe("fc_notif");
  });

  it("merges enabled flag with parent query enablement (default true)", () => {
    renderHookWithProviders(() => useFriendNotificationPrefs("fc_notif" as never), {
      querySource: "remote",
    });
    expect(lastNotifOpts["enabled"]).toBe(true);
  });

  it("respects opts.enabled === false override", () => {
    renderHookWithProviders(
      () => useFriendNotificationPrefs("fc_notif" as never, { enabled: false }),
      { querySource: "remote" },
    );
    expect(lastNotifOpts["enabled"]).toBe(false);
  });
});

describe("useUpdateFriendNotificationPrefs", () => {
  it("invalidates getNotifications and get on success", async () => {
    const { result } = renderHookWithProviders(() => useUpdateFriendNotificationPrefs());
    await act(() => result.current.mutateAsync({ connectionId: "fc_test" } as never));
    // The mocked useUtils returns a fresh utils object per call; assertions on the
    // singleton mockUtils.friend.get cover the cross-cutting "get invalidated" path.
    await waitFor(() => {
      expect(mockUtils.friend.get.invalidate).toHaveBeenCalledWith({ connectionId: "fc_test" });
    });
  });
});

describe("useListReceivedKeyGrants", () => {
  it("uses default enabled true when opts not provided", () => {
    renderHookWithProviders(() => useListReceivedKeyGrants(), { querySource: "remote" });
    expect(lastListReceivedKeyGrantsOpts["enabled"]).toBe(true);
  });

  it("respects opts.enabled === false override", () => {
    renderHookWithProviders(() => useListReceivedKeyGrants({ enabled: false }), {
      querySource: "remote",
    });
    expect(lastListReceivedKeyGrantsOpts["enabled"]).toBe(false);
  });
});
