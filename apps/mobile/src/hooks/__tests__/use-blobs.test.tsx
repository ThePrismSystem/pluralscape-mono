// @vitest-environment happy-dom
import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderHookWithProviders, TEST_SYSTEM_ID } from "./helpers/render-hook-with-providers.js";

import type { BlobId } from "@pluralscape/types";

type CapturedOpts = Record<string, unknown>;
type CapturedInput = Record<string, unknown>;
let lastGetInput: CapturedInput = {};
let lastListOpts: CapturedOpts = {};
let lastDownloadInput: CapturedInput = {};
let lastDownloadOpts: CapturedOpts = {};

const mockUtils = {
  blob: {
    get: { invalidate: vi.fn() },
    list: { invalidate: vi.fn() },
  },
};

vi.mock("@pluralscape/api-client/trpc", async () => {
  const rq = await import("@tanstack/react-query");

  return {
    trpc: {
      blob: {
        get: {
          useQuery: (input: CapturedInput) => {
            lastGetInput = input;
            return { data: undefined, isLoading: true };
          },
        },
        list: {
          useInfiniteQuery: (_input: CapturedInput, opts: CapturedOpts = {}) => {
            lastListOpts = opts;
            return { data: undefined, isLoading: true };
          },
        },
        getDownloadUrl: {
          useQuery: (input: CapturedInput, opts: CapturedOpts = {}) => {
            lastDownloadInput = input;
            lastDownloadOpts = opts;
            return { data: undefined, isLoading: true };
          },
        },
        createUploadUrl: {
          useMutation: (opts: Record<string, unknown> = {}) =>
            rq.useMutation({
              mutationFn: () => Promise.resolve({}),
              onSuccess: opts.onSuccess as (() => void) | undefined,
            }),
        },
        confirmUpload: {
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

const { useBlob, useBlobsList, useBlobDownloadUrl, useDeleteBlob } =
  await import("../use-blobs.js");

beforeEach(() => {
  lastGetInput = {};
  lastListOpts = {};
  lastDownloadInput = {};
  lastDownloadOpts = {};
  vi.clearAllMocks();
});

describe("useBlob", () => {
  it("passes blobId and systemId to query", () => {
    renderHookWithProviders(() => useBlob("blob_test" as BlobId));
    expect(lastGetInput["blobId"]).toBe("blob_test");
    expect(lastGetInput["systemId"]).toBe(TEST_SYSTEM_ID);
  });
});

describe("useBlobsList", () => {
  it("does not require masterKey (no enabled guard)", () => {
    renderHookWithProviders(() => useBlobsList());
    expect(lastListOpts["enabled"]).toBeUndefined();
  });

  it("passes getNextPageParam", () => {
    renderHookWithProviders(() => useBlobsList());
    expect(lastListOpts["getNextPageParam"]).toBeTypeOf("function");
  });
});

describe("useBlobDownloadUrl", () => {
  it("passes blobId and systemId to query", () => {
    renderHookWithProviders(() => useBlobDownloadUrl("blob_dl" as BlobId));
    expect(lastDownloadInput["blobId"]).toBe("blob_dl");
    expect(lastDownloadInput["systemId"]).toBe(TEST_SYSTEM_ID);
  });

  it("sets staleTime: 0 and gcTime: 300_000 to prevent serving expired presigned URLs", () => {
    renderHookWithProviders(() => useBlobDownloadUrl("blob_dl" as BlobId));
    expect(lastDownloadOpts["staleTime"]).toBe(0);
    expect(lastDownloadOpts["gcTime"]).toBe(300_000);
  });
});

describe("useDeleteBlob", () => {
  it("invalidates get (with blobId) and list on success", async () => {
    const { result } = renderHookWithProviders(() => useDeleteBlob());

    await act(() => result.current.mutateAsync({ blobId: "blob_del" } as never));

    await waitFor(() => {
      expect(mockUtils.blob.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        blobId: "blob_del",
      });
      expect(mockUtils.blob.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});
