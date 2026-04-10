import JSZip from "jszip";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMobileAvatarFetcher } from "../avatar-fetcher.js";
import {
  AVATAR_CONCURRENCY,
  AVATAR_MAX_BYTES,
  AVATAR_REQUEST_TIMEOUT_MS,
} from "../import-sp-mobile.constants.js";

const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;
const HTTP_INTERNAL_ERROR = 500;

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function makeResponse(init: {
  readonly status: number;
  readonly body?: Uint8Array;
  readonly contentType?: string;
  readonly contentLength?: number;
}): Response {
  const headers = new Headers();
  if (init.contentType !== undefined) {
    headers.set("content-type", init.contentType);
  }
  if (init.contentLength !== undefined) {
    headers.set("content-length", String(init.contentLength));
  }
  const source = init.body ?? new Uint8Array(0);
  return new Response(toArrayBuffer(source), { status: init.status, headers });
}

describe("createMobileAvatarFetcher (api mode)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("returns ok with bytes and content type on success", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const mockFetch = vi.fn().mockResolvedValue(
      makeResponse({
        status: HTTP_OK,
        body: bytes,
        contentType: "image/png",
        contentLength: bytes.byteLength,
      }),
    );
    vi.stubGlobal("fetch", mockFetch);

    const fetcher = createMobileAvatarFetcher({ mode: "api" });
    const result = await fetcher.fetchAvatar("https://example.com/avatar.png");

    expect(result).toEqual({
      status: "ok",
      bytes,
      contentType: "image/png",
    });
    expect(mockFetch).toHaveBeenCalledWith(
      "https://example.com/avatar.png",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("defaults to application/octet-stream when no content-type header is set", async () => {
    const bytes = new Uint8Array([9, 8]);
    const mockFetch = vi.fn().mockResolvedValue(
      makeResponse({
        status: HTTP_OK,
        body: bytes,
        contentLength: bytes.byteLength,
      }),
    );
    vi.stubGlobal("fetch", mockFetch);

    const fetcher = createMobileAvatarFetcher({ mode: "api" });
    const result = await fetcher.fetchAvatar("https://example.com/avatar");

    expect(result).toEqual({
      status: "ok",
      bytes,
      contentType: "application/octet-stream",
    });
  });

  it("returns not-found on HTTP 404", async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeResponse({ status: HTTP_NOT_FOUND }));
    vi.stubGlobal("fetch", mockFetch);

    const fetcher = createMobileAvatarFetcher({ mode: "api" });
    const result = await fetcher.fetchAvatar("https://example.com/missing.png");

    expect(result).toEqual({ status: "not-found" });
  });

  it("returns error on other non-2xx responses", async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeResponse({ status: HTTP_INTERNAL_ERROR }));
    vi.stubGlobal("fetch", mockFetch);

    const fetcher = createMobileAvatarFetcher({ mode: "api" });
    const result = await fetcher.fetchAvatar("https://example.com/boom.png");

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toContain("500");
    }
  });

  it("returns error when content-length exceeds the max", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      makeResponse({
        status: HTTP_OK,
        contentLength: AVATAR_MAX_BYTES + 1,
        contentType: "image/png",
      }),
    );
    vi.stubGlobal("fetch", mockFetch);

    const fetcher = createMobileAvatarFetcher({ mode: "api" });
    const result = await fetcher.fetchAvatar("https://example.com/huge.png");

    expect(result).toEqual({
      status: "error",
      message: "avatar exceeds maximum size",
    });
  });

  it("returns error when streamed bytes exceed the max with no content-length header", async () => {
    const oversized = new Uint8Array(AVATAR_MAX_BYTES + 1);
    const mockFetch = vi.fn().mockResolvedValue(
      makeResponse({
        status: HTTP_OK,
        body: oversized,
        contentType: "image/png",
      }),
    );
    vi.stubGlobal("fetch", mockFetch);

    const fetcher = createMobileAvatarFetcher({ mode: "api" });
    const result = await fetcher.fetchAvatar("https://example.com/bigger.png");

    expect(result).toEqual({
      status: "error",
      message: "avatar exceeds maximum size",
    });
  });

  it("returns error with a timeout message when the AbortController fires", async () => {
    vi.useFakeTimers();
    const abortError = new DOMException("aborted", "AbortError");
    const mockFetch = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(abortError);
        });
      });
    });
    vi.stubGlobal("fetch", mockFetch);

    const fetcher = createMobileAvatarFetcher({ mode: "api" });
    const resultPromise = fetcher.fetchAvatar("https://example.com/slow.png");
    await vi.advanceTimersByTimeAsync(AVATAR_REQUEST_TIMEOUT_MS + 1);
    const result = await resultPromise;

    expect(result).toEqual({
      status: "error",
      message: "avatar fetch timed out",
    });
  });

  it("returns error on generic network failure", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new TypeError("network down"));
    vi.stubGlobal("fetch", mockFetch);

    const fetcher = createMobileAvatarFetcher({ mode: "api" });
    const result = await fetcher.fetchAvatar("https://example.com/down.png");

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toContain("network down");
    }
  });

  it("caps concurrent fetches to AVATAR_CONCURRENCY", async () => {
    let active = 0;
    let peak = 0;
    const resolvers: Array<() => void> = [];
    const mockFetch = vi.fn(() => {
      active += 1;
      peak = Math.max(peak, active);
      return new Promise<Response>((resolve) => {
        resolvers.push(() => {
          active -= 1;
          resolve(
            makeResponse({
              status: HTTP_OK,
              body: new Uint8Array([0]),
              contentType: "image/png",
              contentLength: 1,
            }),
          );
        });
      });
    });
    vi.stubGlobal("fetch", mockFetch);

    const fetcher = createMobileAvatarFetcher({ mode: "api" });
    const CONCURRENT_CALLS = 10;
    const urls = Array.from(
      { length: CONCURRENT_CALLS },
      (_, i) => `https://example.com/${String(i)}.png`,
    );
    const promises = urls.map((url) => fetcher.fetchAvatar(url));

    // Let the limiter schedule the first wave.
    await Promise.resolve();
    await Promise.resolve();

    expect(active).toBeLessThanOrEqual(AVATAR_CONCURRENCY);
    expect(peak).toBeLessThanOrEqual(AVATAR_CONCURRENCY);

    // Drain all pending fetches in FIFO order.
    while (resolvers.length > 0) {
      const next = resolvers.shift();
      next?.();
      await Promise.resolve();
      await Promise.resolve();
    }

    const results = await Promise.all(promises);
    expect(results).toHaveLength(CONCURRENT_CALLS);
    expect(results.every((r: (typeof results)[number]) => r.status === "ok")).toBe(true);
    expect(peak).toBeLessThanOrEqual(AVATAR_CONCURRENCY);
    expect(peak).toBeGreaterThan(0);
  });
});

describe("createMobileAvatarFetcher (zip mode)", () => {
  async function buildZipWith(
    entries: ReadonlyArray<readonly [string, Uint8Array]>,
  ): Promise<JSZip> {
    const zip = new JSZip();
    for (const [path, bytes] of entries) {
      zip.file(path, bytes);
    }
    const arrayBuffer = await zip.generateAsync({ type: "arraybuffer" });
    return JSZip.loadAsync(arrayBuffer);
  }

  it("returns bytes for a member avatar found in the zip", async () => {
    const bytes = new Uint8Array([10, 20, 30]);
    const zip = await buildZipWith([["avatars/member-123.png", bytes]]);

    const fetcher = createMobileAvatarFetcher({ mode: "zip", zip });
    const result = await fetcher.fetchAvatar("member-123");

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(Array.from(result.bytes)).toEqual(Array.from(bytes));
      expect(result.contentType).toBe("image/png");
    }
  });

  it("infers content type from the file extension", async () => {
    const bytes = new Uint8Array([1, 2]);
    const zip = await buildZipWith([["avatars/abc.jpg", bytes]]);

    const fetcher = createMobileAvatarFetcher({ mode: "zip", zip });
    const result = await fetcher.fetchAvatar("abc");

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.contentType).toBe("image/jpeg");
    }
  });

  it("returns not-found when the zip contains no matching entry", async () => {
    const zip = await buildZipWith([["avatars/other.png", new Uint8Array([0])]]);

    const fetcher = createMobileAvatarFetcher({ mode: "zip", zip });
    const result = await fetcher.fetchAvatar("missing-id");

    expect(result).toEqual({ status: "not-found" });
  });

  it("returns error when the extracted bytes exceed the maximum size", async () => {
    const oversized = new Uint8Array(AVATAR_MAX_BYTES + 1);
    const zip = await buildZipWith([["avatars/big.png", oversized]]);

    const fetcher = createMobileAvatarFetcher({ mode: "zip", zip });
    const result = await fetcher.fetchAvatar("big");

    expect(result).toEqual({
      status: "error",
      message: "avatar exceeds maximum size",
    });
  });
});

describe("createMobileAvatarFetcher (skip mode)", () => {
  it("returns not-found without touching fetch or any zip", async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    const fetcher = createMobileAvatarFetcher({ mode: "skip" });
    const result = await fetcher.fetchAvatar("anything");

    expect(result).toEqual({ status: "not-found" });
    expect(mockFetch).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
