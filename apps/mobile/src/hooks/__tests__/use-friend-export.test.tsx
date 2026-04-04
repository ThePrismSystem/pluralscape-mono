// @vitest-environment happy-dom
import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderHookWithProviders } from "./helpers/render-hook-with-providers.js";

import type { FriendConnectionId } from "@pluralscape/types";

const CONNECTION_ID = "fc_export" as FriendConnectionId;

const mockManifestData = {
  systemId: "sys_abc",
  entries: [{ entityType: "member", count: 5, lastUpdatedAt: 1_700_000_000_000 }],
  keyGrants: [],
  etag: '"v1"',
};

const mockPageData = {
  data: [
    { id: "mem_1", entityType: "member", encryptedData: "base64...", updatedAt: 1_700_000_000_000 },
  ],
  nextCursor: null,
  etag: '"p1"',
};

const mockGet = vi.fn();

vi.mock("../../providers/rest-client-provider.js", () => ({
  useRestClient: () => ({
    GET: mockGet,
  }),
}));

const { useFriendExportManifest, useFriendExportPage } = await import("../use-friend-export.js");

beforeEach(() => {
  vi.resetAllMocks();
});

describe("useFriendExportManifest", () => {
  it("calls GET with manifest path and connectionId", async () => {
    mockGet.mockResolvedValue({
      data: mockManifestData,
      response: { status: 200, headers: new Headers({ ETag: '"v1"' }) },
    });

    const { result } = renderHookWithProviders(() => useFriendExportManifest(CONNECTION_ID));

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockGet).toHaveBeenCalledWith(
      "/account/friends/{connectionId}/export/manifest",
      expect.objectContaining({
        params: expect.objectContaining({
          path: { connectionId: CONNECTION_ID },
        }),
      }),
    );
    expect(result.current.data).toEqual(mockManifestData);
  });

  it("throws when data is null", async () => {
    mockGet.mockResolvedValue({
      data: null,
      response: { status: 404, headers: new Headers() },
    });

    const { result } = renderHookWithProviders(() => useFriendExportManifest(CONNECTION_ID));

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toContain("manifest request failed");
  });

  it("returns undefined on 304 Not Modified (React Query keeps previous data)", async () => {
    // First call returns data
    mockGet.mockResolvedValueOnce({
      data: mockManifestData,
      response: { status: 200, headers: new Headers({ ETag: '"v1"' }) },
    });

    const { result, rerender } = renderHookWithProviders(() =>
      useFriendExportManifest(CONNECTION_ID),
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Second call returns 304 with no data
    mockGet.mockResolvedValueOnce({
      data: undefined,
      response: { status: 304, headers: new Headers({ ETag: '"v1"' }) },
    });

    rerender(undefined);

    // Should not error — React Query keeps stale data
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual(mockManifestData);
  });

  it("propagates network errors to React Query error state", async () => {
    mockGet.mockRejectedValueOnce(new TypeError("Network request failed"));

    const { result } = renderHookWithProviders(() => useFriendExportManifest(CONNECTION_ID));

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(TypeError);
    expect(result.current.error?.message).toBe("Network request failed");
  });
});

describe("useFriendExportPage", () => {
  it("calls GET with export path, entityType, and connectionId", async () => {
    mockGet.mockResolvedValue({
      data: mockPageData,
      response: { status: 200, headers: new Headers({ ETag: '"p1"' }) },
    });

    const { result } = renderHookWithProviders(() =>
      useFriendExportPage(CONNECTION_ID, { entityType: "member" }),
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockGet).toHaveBeenCalledWith(
      "/account/friends/{connectionId}/export",
      expect.objectContaining({
        params: expect.objectContaining({
          path: { connectionId: CONNECTION_ID },
          query: { entityType: "member", cursor: undefined, limit: undefined },
        }),
      }),
    );
    expect(result.current.data).toEqual(mockPageData);
  });

  it("passes cursor and limit to query params", async () => {
    mockGet.mockResolvedValue({
      data: mockPageData,
      response: { status: 200, headers: new Headers() },
    });

    const { result } = renderHookWithProviders(() =>
      useFriendExportPage(CONNECTION_ID, { entityType: "member", cursor: "abc", limit: 25 }),
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockGet).toHaveBeenCalledWith(
      "/account/friends/{connectionId}/export",
      expect.objectContaining({
        params: expect.objectContaining({
          query: { entityType: "member", cursor: "abc", limit: 25 },
        }),
      }),
    );
  });

  it("respects enabled: false", () => {
    renderHookWithProviders(() =>
      useFriendExportPage(CONNECTION_ID, { entityType: "member", enabled: false }),
    );

    expect(mockGet).not.toHaveBeenCalled();
  });

  it("throws when data is null", async () => {
    mockGet.mockResolvedValue({
      data: null,
      response: { status: 500, headers: new Headers() },
    });

    const { result } = renderHookWithProviders(() =>
      useFriendExportPage(CONNECTION_ID, { entityType: "member" }),
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toContain("page request failed");
  });

  it("returns undefined on 304 Not Modified (React Query keeps previous data)", async () => {
    mockGet.mockResolvedValueOnce({
      data: mockPageData,
      response: { status: 200, headers: new Headers({ ETag: '"p1"' }) },
    });

    const { result, rerender } = renderHookWithProviders(() =>
      useFriendExportPage(CONNECTION_ID, { entityType: "member" }),
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    mockGet.mockResolvedValueOnce({
      data: undefined,
      response: { status: 304, headers: new Headers({ ETag: '"p1"' }) },
    });

    rerender(undefined);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual(mockPageData);
  });

  it("propagates network errors to React Query error state", async () => {
    mockGet.mockRejectedValueOnce(new TypeError("Network request failed"));

    const { result } = renderHookWithProviders(() =>
      useFriendExportPage(CONNECTION_ID, { entityType: "member" }),
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(TypeError);
    expect(result.current.error?.message).toBe("Network request failed");
  });
});
