// @vitest-environment happy-dom
import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderHookWithProviders, TEST_SYSTEM_ID } from "./helpers/render-hook-with-providers.js";

type CapturedOpts = Record<string, unknown>;
let lastListOpts: CapturedOpts = {};

const mockUtils = {
  deviceToken: {
    list: { invalidate: vi.fn() },
  },
};

vi.mock("@pluralscape/api-client/trpc", async () => {
  const rq = await import("@tanstack/react-query");

  return {
    trpc: {
      deviceToken: {
        list: {
          useInfiniteQuery: (_input: unknown, opts: CapturedOpts = {}) => {
            lastListOpts = opts;
            return { data: undefined, isLoading: true };
          },
        },
        register: {
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
              onSuccess: opts.onSuccess as (() => void) | undefined,
            }),
        },
        revoke: {
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
              onSuccess: opts.onSuccess as (() => void) | undefined,
            }),
        },
      },
      useUtils: () => mockUtils,
    },
  };
});

const {
  useDeviceTokensList,
  useRegisterDeviceToken,
  useUpdateDeviceToken,
  useRevokeDeviceToken,
  useDeleteDeviceToken,
} = await import("../use-device-tokens.js");

beforeEach(() => {
  lastListOpts = {};
  vi.clearAllMocks();
});

describe("useDeviceTokensList", () => {
  it("does not require masterKey (no enabled guard)", () => {
    renderHookWithProviders(() => useDeviceTokensList());
    expect(lastListOpts["enabled"]).toBeUndefined();
  });

  it("passes getNextPageParam", () => {
    renderHookWithProviders(() => useDeviceTokensList());
    expect(lastListOpts["getNextPageParam"]).toBeTypeOf("function");
  });
});

describe("useRegisterDeviceToken", () => {
  it("invalidates list on success", async () => {
    const { result } = renderHookWithProviders(() => useRegisterDeviceToken());

    await act(() => result.current.mutateAsync({} as never));

    await waitFor(() => {
      expect(mockUtils.deviceToken.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useUpdateDeviceToken", () => {
  it("invalidates list on success", async () => {
    const { result } = renderHookWithProviders(() => useUpdateDeviceToken());

    await act(() => result.current.mutateAsync({} as never));

    await waitFor(() => {
      expect(mockUtils.deviceToken.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useRevokeDeviceToken", () => {
  it("invalidates list on success", async () => {
    const { result } = renderHookWithProviders(() => useRevokeDeviceToken());

    await act(() => result.current.mutateAsync({} as never));

    await waitFor(() => {
      expect(mockUtils.deviceToken.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useDeleteDeviceToken", () => {
  it("invalidates list on success", async () => {
    const { result } = renderHookWithProviders(() => useDeleteDeviceToken());

    await act(() => result.current.mutateAsync({} as never));

    await waitFor(() => {
      expect(mockUtils.deviceToken.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});
