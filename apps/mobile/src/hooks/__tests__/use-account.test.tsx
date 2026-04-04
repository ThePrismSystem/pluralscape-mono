// @vitest-environment happy-dom
import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderHookWithProviders } from "./helpers/render-hook-with-providers.js";

let queryWasCalled = false;

const mockUtils = {
  account: {
    get: { invalidate: vi.fn() },
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
      account: {
        get: {
          useQuery: () => {
            queryWasCalled = true;
            return { data: undefined, isLoading: true };
          },
        },
        changeEmail: { useMutation: makeMutation },
        changePassword: { useMutation: makeMutation },
        updateSettings: { useMutation: makeMutation },
        deleteAccount: { useMutation: makeMutation },
      },
      useUtils: () => mockUtils,
    },
  };
});

const {
  useAccount,
  useChangeEmail,
  useChangePassword,
  useUpdateAccountSettings,
  useDeleteAccount,
} = await import("../use-account.js");

beforeEach(() => {
  queryWasCalled = false;
  vi.clearAllMocks();
});

describe("useAccount", () => {
  it("calls account.get.useQuery with no args", () => {
    renderHookWithProviders(() => useAccount());
    expect(queryWasCalled).toBe(true);
  });
});

describe("useChangeEmail", () => {
  it("invalidates account.get on success", async () => {
    const { result } = renderHookWithProviders(() => useChangeEmail());

    await act(() => result.current.mutateAsync({} as never));

    await waitFor(() => {
      expect(mockUtils.account.get.invalidate).toHaveBeenCalled();
    });
  });
});

describe("useChangePassword", () => {
  it("invalidates account.get on success", async () => {
    const { result } = renderHookWithProviders(() => useChangePassword());

    await act(() => result.current.mutateAsync({} as never));

    await waitFor(() => {
      expect(mockUtils.account.get.invalidate).toHaveBeenCalled();
    });
  });
});

describe("useUpdateAccountSettings", () => {
  it("invalidates account.get on success", async () => {
    const { result } = renderHookWithProviders(() => useUpdateAccountSettings());

    await act(() => result.current.mutateAsync({} as never));

    await waitFor(() => {
      expect(mockUtils.account.get.invalidate).toHaveBeenCalled();
    });
  });
});

describe("useDeleteAccount", () => {
  it("does not invalidate account.get on success", async () => {
    const { result } = renderHookWithProviders(() => useDeleteAccount());

    await act(() => result.current.mutateAsync({} as never));

    await waitFor(() => {
      expect(mockUtils.account.get.invalidate).not.toHaveBeenCalled();
    });
  });
});
