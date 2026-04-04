// @vitest-environment happy-dom
import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderHookWithProviders, TEST_SYSTEM_ID } from "./helpers/render-hook-with-providers.js";

type CapturedInput = Record<string, unknown>;
let lastGetInput: CapturedInput = {};
let lastListInput: CapturedInput = {};

const mockUtils = {
  notificationConfig: {
    get: { invalidate: vi.fn() },
    list: { invalidate: vi.fn() },
  },
};

vi.mock("@pluralscape/api-client/trpc", async () => {
  const rq = await import("@tanstack/react-query");

  return {
    trpc: {
      notificationConfig: {
        get: {
          useQuery: (input: CapturedInput) => {
            lastGetInput = input;
            return { data: undefined, isLoading: true };
          },
        },
        list: {
          useQuery: (input: CapturedInput) => {
            lastListInput = input;
            return { data: undefined, isLoading: true };
          },
        },
        update: {
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

const { useNotificationConfig, useNotificationConfigList, useUpdateNotificationConfig } =
  await import("../use-notification-config.js");

beforeEach(() => {
  lastGetInput = {};
  lastListInput = {};
  vi.clearAllMocks();
});

describe("useNotificationConfig", () => {
  it("passes systemId and eventType to query", () => {
    renderHookWithProviders(() => useNotificationConfig("front_start" as never));
    expect(lastGetInput["systemId"]).toBe(TEST_SYSTEM_ID);
    expect(lastGetInput["eventType"]).toBe("front_start");
  });
});

describe("useNotificationConfigList", () => {
  it("passes systemId to query", () => {
    renderHookWithProviders(() => useNotificationConfigList());
    expect(lastListInput["systemId"]).toBe(TEST_SYSTEM_ID);
  });
});

describe("useUpdateNotificationConfig", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useUpdateNotificationConfig());

    await act(() =>
      result.current.mutateAsync({ eventType: "front_start", enabled: true } as never),
    );

    await waitFor(() => {
      expect(mockUtils.notificationConfig.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        eventType: "front_start",
      });
      expect(mockUtils.notificationConfig.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});
