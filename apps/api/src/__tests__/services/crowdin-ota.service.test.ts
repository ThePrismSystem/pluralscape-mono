import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  CrowdinOtaService,
  CrowdinOtaUpstreamError,
  CrowdinOtaTimeoutError,
} from "../../services/crowdin-ota.service.js";

describe("CrowdinOtaService.fetchManifest", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fetches the manifest JSON from the distribution URL", async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ timestamp: 123, content: { en: ["common"] } }), {
          status: 200,
        }),
      ),
    );
    const svc = new CrowdinOtaService({ distributionHash: "HASH", fetch: mockFetch });
    const manifest = await svc.fetchManifest();
    expect(manifest).toEqual({ timestamp: 123, content: { en: ["common"] } });
    expect(mockFetch).toHaveBeenCalledWith(
      "https://distributions.crowdin.net/HASH/manifest.json",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("throws CrowdinOtaUpstreamError on non-2xx", async () => {
    const mockFetch = vi.fn(() => Promise.resolve(new Response("nope", { status: 503 })));
    const svc = new CrowdinOtaService({ distributionHash: "HASH", fetch: mockFetch });
    await expect(svc.fetchManifest()).rejects.toBeInstanceOf(CrowdinOtaUpstreamError);
  });

  it("throws CrowdinOtaTimeoutError when fetch exceeds timeout", async () => {
    const mockFetch = vi.fn(
      (_url: string, init?: { signal?: AbortSignal }) =>
        new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new Error("aborted"));
          });
        }),
    );
    const svc = new CrowdinOtaService({
      distributionHash: "HASH",
      fetch: mockFetch,
      timeoutMs: 100,
    });
    const p = svc.fetchManifest();
    // Attach catch synchronously so the rejection isn't flagged as unhandled
    // while we advance the fake clock. Vitest's fake timers never run the real
    // microtask scheduler, so we'd otherwise see an unhandled-rejection warning.
    const assertion = expect(p).rejects.toBeInstanceOf(CrowdinOtaTimeoutError);
    await vi.advanceTimersByTimeAsync(200);
    await assertion;
  });
});

describe("CrowdinOtaService.fetchNamespace", () => {
  it("fetches content/{locale}/{namespace}.json", async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ greeting: "Hola" }), { status: 200 })),
    );
    const svc = new CrowdinOtaService({ distributionHash: "HASH", fetch: mockFetch });
    const out = await svc.fetchNamespace("es", "common");
    expect(out).toEqual({ greeting: "Hola" });
    expect(mockFetch).toHaveBeenCalledWith(
      "https://distributions.crowdin.net/HASH/content/es/common.json",
      expect.any(Object),
    );
  });

  it("throws upstream error on 404", async () => {
    const mockFetch = vi.fn(() => Promise.resolve(new Response("", { status: 404 })));
    const svc = new CrowdinOtaService({ distributionHash: "HASH", fetch: mockFetch });
    await expect(svc.fetchNamespace("es", "common")).rejects.toBeInstanceOf(
      CrowdinOtaUpstreamError,
    );
  });
});
