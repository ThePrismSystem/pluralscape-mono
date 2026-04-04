// @vitest-environment happy-dom
import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderHookWithProviders } from "./helpers/render-hook-with-providers.js";

const mockUtils = {};

vi.mock("@pluralscape/api-client/trpc", async () => {
  const rq = await import("@tanstack/react-query");

  const makeMutation = () =>
    rq.useMutation({
      mutationFn: () => Promise.resolve({}),
    });

  return {
    trpc: {
      account: {
        initiateDeviceTransfer: { useMutation: makeMutation },
        approveDeviceTransfer: { useMutation: makeMutation },
        completeDeviceTransfer: { useMutation: makeMutation },
      },
      useUtils: () => mockUtils,
    },
  };
});

const { useInitiateDeviceTransfer, useApproveDeviceTransfer, useCompleteDeviceTransfer } =
  await import("../use-device-transfer.js");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useInitiateDeviceTransfer", () => {
  it("mutation can be called and succeeds", async () => {
    const { result } = renderHookWithProviders(() => useInitiateDeviceTransfer());

    await act(() => result.current.mutateAsync({} as never));

    expect(result.current.isError).toBe(false);
  });
});

describe("useApproveDeviceTransfer", () => {
  it("mutation can be called and succeeds", async () => {
    const { result } = renderHookWithProviders(() => useApproveDeviceTransfer());

    await act(() => result.current.mutateAsync({} as never));

    expect(result.current.isError).toBe(false);
  });
});

describe("useCompleteDeviceTransfer", () => {
  it("mutation can be called and succeeds", async () => {
    const { result } = renderHookWithProviders(() => useCompleteDeviceTransfer());

    await act(() => result.current.mutateAsync({} as never));

    expect(result.current.isError).toBe(false);
  });
});
