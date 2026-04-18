import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { CrowdinOtaFailure, CrowdinOtaService } from "../../services/crowdin-ota.service.js";

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

  it("throws CrowdinOtaFailure with kind=upstream on non-2xx", async () => {
    const mockFetch = vi.fn(() => Promise.resolve(new Response("nope", { status: 503 })));
    const svc = new CrowdinOtaService({ distributionHash: "HASH", fetch: mockFetch });
    await expect(svc.fetchManifest()).rejects.toMatchObject({
      name: "CrowdinOtaFailure",
      detail: { kind: "upstream", status: 503 },
    });
    await expect(svc.fetchManifest()).rejects.toBeInstanceOf(CrowdinOtaFailure);
  });

  it("throws CrowdinOtaFailure with kind=timeout when fetch exceeds timeout", async () => {
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
    const assertion = expect(p).rejects.toMatchObject({
      name: "CrowdinOtaFailure",
      detail: { kind: "timeout", timeoutMs: 100 },
    });
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

  it("throws CrowdinOtaFailure with kind=upstream and status=404 on 404", async () => {
    const mockFetch = vi.fn(() => Promise.resolve(new Response("", { status: 404 })));
    const svc = new CrowdinOtaService({ distributionHash: "HASH", fetch: mockFetch });
    await expect(svc.fetchNamespace("es", "common")).rejects.toMatchObject({
      name: "CrowdinOtaFailure",
      detail: { kind: "upstream", status: 404 },
    });
  });
});

describe("CrowdinOtaService payload validation", () => {
  it("throws CrowdinOtaFailure(kind=malformed) on malformed manifest payload", async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ not_a_timestamp: "bad" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    const svc = new CrowdinOtaService({ distributionHash: "HASH", fetch: mockFetch });
    await expect(svc.fetchManifest()).rejects.toMatchObject({
      name: "CrowdinOtaFailure",
      detail: { kind: "malformed" },
    });
  });

  it("throws CrowdinOtaFailure(kind=malformed) on malformed namespace payload", async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve(
        // value must be string, 42 is invalid
        new Response(JSON.stringify({ some_key: 42 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    const svc = new CrowdinOtaService({ distributionHash: "HASH", fetch: mockFetch });
    await expect(svc.fetchNamespace("es", "common")).rejects.toMatchObject({
      name: "CrowdinOtaFailure",
      detail: { kind: "malformed" },
    });
  });

  it("does NOT classify a non-timeout network error as a CrowdinOtaFailure", async () => {
    const mockFetch = vi.fn(() => Promise.reject(new TypeError("Failed to fetch")));
    const svc = new CrowdinOtaService({
      distributionHash: "HASH",
      fetch: mockFetch,
      timeoutMs: 100,
    });
    await expect(svc.fetchManifest()).rejects.toMatchObject({
      name: "TypeError",
      message: "Failed to fetch",
    });
  });
});

/**
 * Additional path coverage for `fetchJson`: parse failure on the response body
 * and timer cleanup on the success path. These run with real timers because
 * `vi.spyOn(globalThis, "clearTimeout")` on fake timers spies on the wrong
 * slot (vi installs its own bindings) — real-timer execution is the only
 * reliable way to assert the cleanup `clearTimeout` call was made.
 */
describe("CrowdinOtaService.fetchJson internals", () => {
  it("propagates res.json() rejection as a raw SyntaxError (no timeout tag)", async () => {
    // Build a Response whose `.json()` rejects. The rejection happens inside
    // `fetchJson`'s try/catch; because our timer hasn't fired, the catch
    // re-throws the raw error rather than tagging it `kind: "timeout"`.
    const badResponse = new Response("not-json", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    Object.defineProperty(badResponse, "json", {
      value: () => Promise.reject(new SyntaxError("Unexpected token")),
    });
    const fetchMock = vi.fn(() => Promise.resolve(badResponse));
    const svc = new CrowdinOtaService({ distributionHash: "HASH", fetch: fetchMock });
    await expect(svc.fetchManifest()).rejects.toMatchObject({
      name: "SyntaxError",
      message: "Unexpected token",
    });
  });

  it("calls clearTimeout on a successful fetch", async () => {
    const clearSpy = vi.spyOn(globalThis, "clearTimeout");
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ timestamp: 1, content: { en: ["common"] } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    const svc = new CrowdinOtaService({ distributionHash: "HASH", fetch: fetchMock });
    await svc.fetchManifest();
    // The cleanup `clearTimeout` runs in `fetchJson`'s finally block — one
    // call per fetch. Assert at-least-once so this stays robust against
    // unrelated `clearTimeout` calls that may happen elsewhere (e.g.
    // node:http internals during a real fetch shim).
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});
