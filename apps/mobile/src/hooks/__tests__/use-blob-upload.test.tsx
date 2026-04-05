// @vitest-environment happy-dom
import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderHookWithProviders, TEST_SYSTEM_ID } from "./helpers/render-hook-with-providers.js";

import type { BlobPurpose } from "@pluralscape/types";

const MOCK_UPLOAD_URL = "https://storage.example.com/upload?token=abc";
const MOCK_BLOB_ID = "blob_new";

// Mutable handles so individual tests can override
const mockCreateUploadUrl = vi.fn(() =>
  Promise.resolve({ uploadUrl: MOCK_UPLOAD_URL, blobId: MOCK_BLOB_ID, expiresAt: 0 }),
);
const mockConfirmUpload = vi.fn(() => Promise.resolve({ id: MOCK_BLOB_ID }));

const mockUtils = {
  blob: {
    get: { invalidate: vi.fn() },
    list: { invalidate: vi.fn() },
  },
};

const mockFetch = vi.fn(() => Promise.resolve(new Response(null, { status: 200 })));
vi.stubGlobal("fetch", mockFetch);

vi.mock("@pluralscape/crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@pluralscape/crypto")>();
  return {
    ...actual,
    getSodium: () => ({
      genericHash: (_len: number, data: Uint8Array) => {
        // Deterministic fake: return first 32 bytes zero-padded
        const out = new Uint8Array(32);
        out.set(data.subarray(0, 32));
        return out;
      },
    }),
  };
});

vi.mock("@pluralscape/api-client/trpc", () => {
  return {
    trpc: {
      blob: {
        createUploadUrl: {
          useMutation: () => ({ mutateAsync: mockCreateUploadUrl }),
        },
        confirmUpload: {
          useMutation: () => ({ mutateAsync: mockConfirmUpload }),
        },
        // CRUD hooks are not exercised here but must exist for the module to load
        get: { useQuery: () => ({ data: undefined, isLoading: true }) },
        list: {
          useInfiniteQuery: () => ({ data: undefined, isLoading: true }),
        },
        getDownloadUrl: { useQuery: () => ({ data: undefined, isLoading: true }) },
        delete: { useMutation: () => ({ mutateAsync: vi.fn() }) },
      },
      useUtils: () => mockUtils,
    },
  };
});

const { useBlobUpload } = await import("../use-blobs.js");

const TEST_INPUT = {
  purpose: "attachment" as BlobPurpose,
  mimeType: "image/png",
  sizeBytes: 1024,
  encryptionTier: 1 as const,
  file: new Blob(["test"]),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateUploadUrl.mockResolvedValue({
    uploadUrl: MOCK_UPLOAD_URL,
    blobId: MOCK_BLOB_ID,
    expiresAt: 0,
  });
  mockConfirmUpload.mockResolvedValue({ id: MOCK_BLOB_ID });
  mockFetch.mockResolvedValue(new Response(null, { status: 200 }));
});

describe("useBlobUpload", () => {
  it("starts in idle state", () => {
    const { result } = renderHookWithProviders(() => useBlobUpload());
    expect(result.current.status).toBe("idle");
    expect(result.current.progress).toBe(0);
    expect(result.current.error).toBeNull();
    expect(result.current.result).toBeNull();
  });

  it("completes full upload flow", async () => {
    const { result } = renderHookWithProviders(() => useBlobUpload());

    act(() => {
      result.current.upload(TEST_INPUT);
    });

    await waitFor(() => {
      expect(result.current.status).toBe("success");
    });

    expect(mockCreateUploadUrl).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      purpose: TEST_INPUT.purpose,
      mimeType: TEST_INPUT.mimeType,
      sizeBytes: TEST_INPUT.sizeBytes,
      encryptionTier: TEST_INPUT.encryptionTier,
    });

    expect(mockFetch).toHaveBeenCalledWith(MOCK_UPLOAD_URL, {
      method: "PUT",
      body: TEST_INPUT.file,
      headers: { "Content-Type": TEST_INPUT.mimeType },
    });

    expect(mockConfirmUpload).toHaveBeenCalledWith(
      expect.objectContaining({ systemId: TEST_SYSTEM_ID, blobId: MOCK_BLOB_ID }),
    );

    expect(mockUtils.blob.list.invalidate).toHaveBeenCalledWith({ systemId: TEST_SYSTEM_ID });
    expect(result.current.progress).toBe(1);
    expect(result.current.result).toEqual({ id: MOCK_BLOB_ID });
  });

  it("sets error when createUploadUrl fails", async () => {
    mockCreateUploadUrl.mockRejectedValue(new Error("URL generation failed"));

    const { result } = renderHookWithProviders(() => useBlobUpload());

    act(() => {
      result.current.upload(TEST_INPUT);
    });

    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });

    expect(result.current.error?.message).toBe("URL generation failed");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("sets error when PUT fails", async () => {
    mockFetch.mockResolvedValue(new Response(null, { status: 500 }));

    const { result } = renderHookWithProviders(() => useBlobUpload());

    act(() => {
      result.current.upload(TEST_INPUT);
    });

    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });

    expect(result.current.error?.message).toContain("500");
    expect(mockConfirmUpload).not.toHaveBeenCalled();
  });

  it("sets error when confirmUpload fails", async () => {
    mockConfirmUpload.mockRejectedValue(new Error("Confirm failed"));

    const { result } = renderHookWithProviders(() => useBlobUpload());

    act(() => {
      result.current.upload(TEST_INPUT);
    });

    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });

    expect(result.current.error?.message).toBe("Confirm failed");
    expect(mockUtils.blob.list.invalidate).not.toHaveBeenCalled();
  });

  it("reset returns to idle after a completed upload", async () => {
    const { result } = renderHookWithProviders(() => useBlobUpload());

    act(() => {
      result.current.upload(TEST_INPUT);
    });

    await waitFor(() => {
      expect(result.current.status).toBe("success");
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.progress).toBe(0);
    expect(result.current.error).toBeNull();
    expect(result.current.result).toBeNull();
  });

  it("passes checksum to confirmUpload", async () => {
    const { result } = renderHookWithProviders(() => useBlobUpload());

    act(() => {
      result.current.upload(TEST_INPUT);
    });

    await waitFor(() => {
      expect(result.current.status).toBe("success");
    });

    // BLAKE2b-256 of "test" produces a 64-char hex string
    expect(mockConfirmUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        systemId: TEST_SYSTEM_ID,
        blobId: MOCK_BLOB_ID,
        checksum: expect.stringMatching(/^[0-9a-f]{64}$/),
      }),
    );
  });

  it("discards stale upload after reset", async () => {
    // Make createUploadUrl slow so we can reset mid-flight
    let resolveUrl!: (v: { uploadUrl: string; blobId: string; expiresAt: number }) => void;
    mockCreateUploadUrl.mockImplementation(
      () =>
        new Promise<{ uploadUrl: string; blobId: string; expiresAt: number }>((resolve) => {
          resolveUrl = resolve;
        }),
    );

    const { result } = renderHookWithProviders(() => useBlobUpload());

    // Start upload — it will block on createUploadUrl
    act(() => {
      result.current.upload(TEST_INPUT);
    });
    expect(result.current.status).toBe("requesting-url");

    // Reset while first upload is in-flight
    act(() => {
      result.current.reset();
    });
    expect(result.current.status).toBe("idle");

    // Resolve the stale upload — should NOT change state
    resolveUrl({ uploadUrl: MOCK_UPLOAD_URL, blobId: MOCK_BLOB_ID, expiresAt: 0 });
    await waitFor(() => {
      // give the microtask queue a chance to settle
      expect(result.current.status).not.toBe("requesting-url");
    });

    // Status should still be idle (stale upload discarded)
    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeNull();
    // The stale upload should not have proceeded to fetch or confirm
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockConfirmUpload).not.toHaveBeenCalled();
  });
});
