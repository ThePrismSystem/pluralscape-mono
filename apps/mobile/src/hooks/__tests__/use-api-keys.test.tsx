// @vitest-environment happy-dom
import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderHookWithProviders, TEST_SYSTEM_ID } from "./helpers/render-hook-with-providers.js";

import type { ApiKeyId } from "@pluralscape/types";

type CapturedOpts = Record<string, unknown>;
type CapturedInput = Record<string, unknown>;
let lastQueryInput: CapturedInput = {};
let lastListInput: CapturedInput = {};
let lastListOpts: CapturedOpts = {};

const mockUtils = {
  apiKey: {
    get: { invalidate: vi.fn() },
    list: { invalidate: vi.fn() },
  },
};

vi.mock("@pluralscape/api-client/trpc", async () => {
  const rq = await import("@tanstack/react-query");

  return {
    trpc: {
      apiKey: {
        get: {
          useQuery: (input: CapturedInput) => {
            lastQueryInput = input;
            return { data: undefined, isLoading: true };
          },
        },
        list: {
          useInfiniteQuery: (input: CapturedInput, opts: CapturedOpts = {}) => {
            lastListInput = input;
            lastListOpts = opts;
            return { data: undefined, isLoading: true };
          },
        },
        create: {
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

const { useApiKey, useApiKeysList, useCreateApiKey, useRevokeApiKey } =
  await import("../use-api-keys.js");

beforeEach(() => {
  lastQueryInput = {};
  lastListInput = {};
  lastListOpts = {};
  vi.clearAllMocks();
});

describe("useApiKey", () => {
  it("passes apiKeyId and systemId to query", () => {
    renderHookWithProviders(() => useApiKey("ak_test" as ApiKeyId));
    expect(lastQueryInput["apiKeyId"]).toBe("ak_test");
    expect(lastQueryInput["systemId"]).toBe(TEST_SYSTEM_ID);
  });
});

describe("useApiKeysList", () => {
  it("does not require masterKey (no enabled guard)", () => {
    renderHookWithProviders(() => useApiKeysList());
    expect(lastListOpts["enabled"]).toBeUndefined();
  });

  it("passes getNextPageParam", () => {
    renderHookWithProviders(() => useApiKeysList());
    expect(lastListOpts["getNextPageParam"]).toBeTypeOf("function");
  });

  it("passes includeRevoked filter when provided", () => {
    renderHookWithProviders(() => useApiKeysList({ includeRevoked: true }));
    expect(lastListInput["includeRevoked"]).toBe(true);
  });
});

describe("useCreateApiKey", () => {
  it("invalidates list on success", async () => {
    const { result } = renderHookWithProviders(() => useCreateApiKey());

    await act(() => result.current.mutateAsync({} as never));

    await waitFor(() => {
      expect(mockUtils.apiKey.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useRevokeApiKey", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useRevokeApiKey());

    await act(() => result.current.mutateAsync({ apiKeyId: "ak_1" } as never));

    await waitFor(() => {
      expect(mockUtils.apiKey.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        apiKeyId: "ak_1",
      });
      expect(mockUtils.apiKey.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});
