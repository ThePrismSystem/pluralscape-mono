// @vitest-environment happy-dom
import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderHookWithProviders } from "./helpers/render-hook-with-providers.js";

const mockUtils = {
  account: {
    getRecoveryKeyStatus: { invalidate: vi.fn() },
  },
};

vi.mock("@pluralscape/api-client/trpc", async () => {
  const rq = await import("@tanstack/react-query");

  return {
    trpc: {
      account: {
        setPin: {
          useMutation: () =>
            rq.useMutation({
              mutationFn: () => Promise.resolve({ success: true as const }),
            }),
        },
        removePin: {
          useMutation: () =>
            rq.useMutation({
              mutationFn: () => Promise.resolve({ success: true as const }),
            }),
        },
        verifyPin: {
          useMutation: () =>
            rq.useMutation({
              mutationFn: () => Promise.resolve({ verified: true }),
            }),
        },
        enrollBiometric: {
          useMutation: () =>
            rq.useMutation({
              mutationFn: () => Promise.resolve({}),
            }),
        },
        verifyBiometric: {
          useMutation: () =>
            rq.useMutation({
              mutationFn: () => Promise.resolve({}),
            }),
        },
        getRecoveryKeyStatus: {
          useQuery: () => ({ data: undefined, isLoading: true }),
        },
        regenerateRecoveryKey: {
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
  useSetPin,
  useRemovePin,
  useVerifyPin,
  useEnrollBiometric,
  useVerifyBiometric,
  useRecoveryKeyStatus,
  useRegenerateRecoveryKey,
} = await import("../use-account-security.js");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useSetPin", () => {
  it("can be called", async () => {
    const { result } = renderHookWithProviders(() => useSetPin());
    await expect(act(() => result.current.mutateAsync({} as never))).resolves.not.toThrow();
  });
});

describe("useRemovePin", () => {
  it("can be called", async () => {
    const { result } = renderHookWithProviders(() => useRemovePin());
    await expect(act(() => result.current.mutateAsync({} as never))).resolves.not.toThrow();
  });
});

describe("useVerifyPin", () => {
  it("can be called", async () => {
    const { result } = renderHookWithProviders(() => useVerifyPin());
    await expect(act(() => result.current.mutateAsync({} as never))).resolves.not.toThrow();
  });
});

describe("useEnrollBiometric", () => {
  it("can be called", async () => {
    const { result } = renderHookWithProviders(() => useEnrollBiometric());
    await expect(act(() => result.current.mutateAsync({} as never))).resolves.not.toThrow();
  });
});

describe("useVerifyBiometric", () => {
  it("can be called", async () => {
    const { result } = renderHookWithProviders(() => useVerifyBiometric());
    await expect(act(() => result.current.mutateAsync({} as never))).resolves.not.toThrow();
  });
});

describe("useRecoveryKeyStatus", () => {
  it("calls getRecoveryKeyStatus query", () => {
    const { result } = renderHookWithProviders(() => useRecoveryKeyStatus());
    expect(result.current.isLoading).toBe(true);
  });
});

describe("useRegenerateRecoveryKey", () => {
  it("invalidates getRecoveryKeyStatus on success", async () => {
    const { result } = renderHookWithProviders(() => useRegenerateRecoveryKey());

    await act(() => result.current.mutateAsync({} as never));

    await waitFor(() => {
      expect(mockUtils.account.getRecoveryKeyStatus.invalidate).toHaveBeenCalled();
    });
  });
});
