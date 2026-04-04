// @vitest-environment happy-dom
import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderHookWithProviders, TEST_SYSTEM_ID } from "./helpers/render-hook-with-providers.js";

type CapturedOpts = Record<string, unknown>;
let lastListOpts: CapturedOpts = {};
let lastGetInput: Record<string, unknown> = {};

const mockUtils = {
  bucket: {
    get: { invalidate: vi.fn() },
    list: { invalidate: vi.fn() },
  },
};

vi.mock("@pluralscape/api-client/trpc", async () => {
  const rq = await import("@tanstack/react-query");

  return {
    trpc: {
      bucket: {
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
        create: {
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
        archive: {
          useMutation: (opts: Record<string, unknown> = {}) =>
            rq.useMutation({
              mutationFn: () => Promise.resolve({}),
              onSuccess: opts.onSuccess as (() => void) | undefined,
            }),
        },
        restore: {
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
  usePrivacyBucket,
  usePrivacyBucketsList,
  useCreatePrivacyBucket,
  useUpdatePrivacyBucket,
  useArchivePrivacyBucket,
  useRestorePrivacyBucket,
} = await import("../use-privacy-buckets.js");

beforeEach(() => {
  lastListOpts = {};
  lastGetInput = {};
  vi.clearAllMocks();
});

describe("usePrivacyBucket", () => {
  it("passes systemId and bucketId to query", () => {
    renderHookWithProviders(() => usePrivacyBucket("bkt_test" as never));
    expect(lastGetInput["systemId"]).toBe(TEST_SYSTEM_ID);
    expect(lastGetInput["bucketId"]).toBe("bkt_test");
  });
});

describe("usePrivacyBucketsList", () => {
  it("does not require masterKey (no enabled guard)", () => {
    renderHookWithProviders(() => usePrivacyBucketsList());
    expect(lastListOpts["enabled"]).toBeUndefined();
  });

  it("passes getNextPageParam", () => {
    renderHookWithProviders(() => usePrivacyBucketsList());
    expect(lastListOpts["getNextPageParam"]).toBeTypeOf("function");
  });
});

describe("useCreatePrivacyBucket", () => {
  it("invalidates list on success", async () => {
    const { result } = renderHookWithProviders(() => useCreatePrivacyBucket());

    await act(() => result.current.mutateAsync({} as never));

    await waitFor(() => {
      expect(mockUtils.bucket.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useUpdatePrivacyBucket", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useUpdatePrivacyBucket());

    await act(() => result.current.mutateAsync({ bucketId: "bkt_test" } as never));

    await waitFor(() => {
      expect(mockUtils.bucket.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        bucketId: "bkt_test",
      });
      expect(mockUtils.bucket.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useArchivePrivacyBucket", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useArchivePrivacyBucket());

    await act(() => result.current.mutateAsync({ bucketId: "bkt_test" } as never));

    await waitFor(() => {
      expect(mockUtils.bucket.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        bucketId: "bkt_test",
      });
      expect(mockUtils.bucket.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useRestorePrivacyBucket", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useRestorePrivacyBucket());

    await act(() => result.current.mutateAsync({ bucketId: "bkt_test" } as never));

    await waitFor(() => {
      expect(mockUtils.bucket.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        bucketId: "bkt_test",
      });
      expect(mockUtils.bucket.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});
