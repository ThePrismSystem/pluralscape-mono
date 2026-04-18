import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { logger } from "../../../lib/logger.js";
import { ValkeyCache, type ValkeyCacheClient } from "../../../lib/valkey-cache.js";
import { handleManifest } from "../../../routes/i18n/manifest.js";
import {
  CrowdinOtaService,
  CrowdinOtaUpstreamError,
  type CrowdinOtaFetch,
} from "../../../services/crowdin-ota.service.js";

/**
 * In-memory fake backing a real ValkeyCache. Prefer constructing the real
 * class over casting a partial mock — zero `as unknown as ValkeyCache`.
 */
function createInMemoryCache(): ValkeyCache {
  const store = new Map<string, string>();
  const client: ValkeyCacheClient = {
    get(key) {
      return Promise.resolve(store.get(key) ?? null);
    },
    set(key, value) {
      store.set(key, value);
      return Promise.resolve("OK" as const);
    },
    del(key) {
      return Promise.resolve(store.delete(key) ? 1 : 0);
    },
  };
  return new ValkeyCache(client, "test");
}

function createOtaService(fetchImpl: CrowdinOtaFetch): CrowdinOtaService {
  return new CrowdinOtaService({
    distributionHash: "test-hash",
    fetch: fetchImpl,
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

interface ManifestEnvelope {
  readonly data: {
    readonly distributionTimestamp: number;
    readonly locales: readonly {
      readonly locale: string;
      readonly namespaces: readonly unknown[];
    }[];
  };
}

describe("GET /manifest", () => {
  let ota: CrowdinOtaService;
  let cache: ValkeyCache;
  let app: Hono;
  let fetchMock: ReturnType<typeof vi.fn<CrowdinOtaFetch>>;

  beforeEach(() => {
    fetchMock = vi.fn<CrowdinOtaFetch>().mockImplementation(() =>
      Promise.resolve(
        jsonResponse({
          timestamp: 1000,
          content: { en: ["common.json"], es: ["common.json"] },
        }),
      ),
    );
    ota = createOtaService(fetchMock);
    cache = createInMemoryCache();
    app = new Hono();
    app.get("/manifest", (c) => handleManifest(c, { ota, cache }));
  });

  it("returns manifest on cache miss and populates cache", async () => {
    const res = await app.request("/manifest");
    expect(res.status).toBe(200);
    const body = (await res.json()) as ManifestEnvelope;
    expect(body.data.distributionTimestamp).toBe(1000);
    expect(body.data.locales).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns cached manifest on second call", async () => {
    await app.request("/manifest");
    await app.request("/manifest");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("strips the .json suffix from namespace names", async () => {
    const res = await app.request("/manifest");
    const body = (await res.json()) as ManifestEnvelope;
    const names = body.data.locales.flatMap((loc) =>
      loc.namespaces.map((n) => (n as { name: string }).name),
    );
    expect(names).toEqual(["common", "common"]);
  });

  it("returns 502 on upstream failure", async () => {
    fetchMock.mockImplementationOnce(() =>
      Promise.reject(new CrowdinOtaUpstreamError("boom", 500)),
    );
    const res = await app.request("/manifest");
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UPSTREAM_UNAVAILABLE");
  });

  // A post-fetch Valkey disconnect must not convert a successful upstream
  // fetch into a 5xx — the upstream result is already in hand and the cache
  // is an optimization. Regression guard for the inline-try/catch oversight
  // that the `trySetJSON` helper replaced.
  it("returns 200 with manifest body even when cache write fails (best-effort)", async () => {
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    const failingCache = new ValkeyCache(
      {
        get: () => Promise.resolve(null),
        set: () => Promise.reject(new Error("connection lost")),
        del: () => Promise.resolve(0),
      },
      "test",
    );
    const failingApp = new Hono();
    failingApp.get("/manifest", (c) => handleManifest(c, { ota, cache: failingCache }));
    const res = await failingApp.request("/manifest");
    expect(res.status).toBe(200);
    const body = (await res.json()) as ManifestEnvelope;
    expect(body.data.distributionTimestamp).toBe(1000);
    expect(warnSpy).toHaveBeenCalledWith(
      "valkey-cache: setJSON failed, continuing",
      expect.objectContaining({ error: "connection lost" }),
    );
    warnSpy.mockRestore();
  });
});
