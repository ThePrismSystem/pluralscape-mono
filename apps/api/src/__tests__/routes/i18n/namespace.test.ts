import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { logger } from "../../../lib/logger.js";
import { ValkeyCache } from "../../../lib/valkey-cache.js";
import { handleNamespace } from "../../../routes/i18n/namespace.js";
import {
  CrowdinOtaFailure,
  CrowdinOtaService,
  type CrowdinOtaFetch,
} from "../../../services/crowdin-ota.service.js";
import { createInMemoryValkeyCache } from "../../test-helpers/valkey-cache.js";

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

interface NamespaceEnvelope {
  readonly data: {
    readonly translations: Readonly<Record<string, string>>;
  };
}

describe("GET /:locale/:namespace", () => {
  let ota: CrowdinOtaService;
  let cache: ValkeyCache;
  let app: Hono;
  let fetchMock: ReturnType<typeof vi.fn<CrowdinOtaFetch>>;

  beforeEach(() => {
    fetchMock = vi
      .fn<CrowdinOtaFetch>()
      .mockImplementation(() => Promise.resolve(jsonResponse({ greeting: "Hola" })));
    ota = createOtaService(fetchMock);
    cache = createInMemoryValkeyCache().cache;
    app = new Hono();
    app.get("/:locale/:namespace", (c) => handleNamespace(c, { ota, cache }));
  });

  it("returns translations with ETag on first call", async () => {
    const res = await app.request("/es/common");
    expect(res.status).toBe(200);
    const etag = res.headers.get("etag");
    expect(etag).toMatch(/^"[0-9a-f]{16}"$/);
    const body = (await res.json()) as NamespaceEnvelope;
    expect(body.data.translations).toEqual({ greeting: "Hola" });
  });

  it("returns Cache-Control header for revalidation", async () => {
    const res = await app.request("/es/common");
    expect(res.headers.get("cache-control")).toBe("public, max-age=0, must-revalidate");
  });

  it("caches upstream result so second call does not re-fetch", async () => {
    await app.request("/es/common");
    await app.request("/es/common");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns 304 when If-None-Match matches", async () => {
    const first = await app.request("/es/common");
    const etag = first.headers.get("etag");
    expect(etag).not.toBeNull();
    const second = await app.request("/es/common", {
      headers: { "if-none-match": etag ?? "" },
    });
    expect(second.status).toBe(304);
    const text = await second.text();
    expect(text).toBe("");
  });

  it("returns 200 with fresh body when If-None-Match mismatches", async () => {
    await app.request("/es/common");
    const res = await app.request("/es/common", {
      headers: { "if-none-match": '"stale1234567890ab"' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as NamespaceEnvelope;
    expect(body.data.translations).toEqual({ greeting: "Hola" });
  });

  it("returns 502 on upstream failure", async () => {
    fetchMock.mockImplementationOnce(() =>
      Promise.reject(new CrowdinOtaFailure({ kind: "upstream", status: 500, message: "boom" })),
    );
    const res = await app.request("/es/common");
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UPSTREAM_UNAVAILABLE");
  });

  it("returns 404 when Crowdin returns 404", async () => {
    fetchMock.mockImplementationOnce(() =>
      Promise.reject(
        new CrowdinOtaFailure({ kind: "upstream", status: 404, message: "not found" }),
      ),
    );
    const res = await app.request("/xx/missing");
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("NAMESPACE_NOT_FOUND");
  });

  // Handler-boundary coverage for the `timeout` variant of the exhaustive
  // switch in `handleNamespace`. Unlike the 404 branch, timeouts cannot be
  // disambiguated as "missing vs. broken" — we default to the pessimistic
  // 502 UPSTREAM_UNAVAILABLE so the client can retry/backoff.
  it("returns 502 UPSTREAM_UNAVAILABLE on Crowdin timeout failure", async () => {
    fetchMock.mockImplementationOnce(() =>
      Promise.reject(new CrowdinOtaFailure({ kind: "timeout", timeoutMs: 5_000 })),
    );
    const res = await app.request("/es/common");
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UPSTREAM_UNAVAILABLE");
  });

  // Handler-boundary coverage for the `malformed` variant — Crowdin returned
  // a 200 but the body failed schema validation. Never a 404 because the
  // distribution exists; surfacing the upstream-contract break explicitly.
  it("returns 502 UPSTREAM_UNAVAILABLE on malformed Crowdin payload", async () => {
    fetchMock.mockImplementationOnce(() =>
      Promise.reject(new CrowdinOtaFailure({ kind: "malformed", reason: "bad shape" })),
    );
    const res = await app.request("/es/common");
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UPSTREAM_UNAVAILABLE");
  });

  // Regression guard: once upstream returns translations, a subsequent
  // Valkey write failure must not be converted into a 5xx — the fresh
  // payload is already in hand.
  it("returns 200 with translations body even when cache write fails (best-effort)", async () => {
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
    failingApp.get("/:locale/:namespace", (c) => handleNamespace(c, { ota, cache: failingCache }));
    const res = await failingApp.request("/es/common");
    expect(res.status).toBe(200);
    const body = (await res.json()) as NamespaceEnvelope;
    expect(body.data.translations).toEqual({ greeting: "Hola" });
    expect(warnSpy).toHaveBeenCalledWith(
      "valkey-cache: setJSON failed, continuing",
      expect.objectContaining({ error: "connection lost" }),
    );
    warnSpy.mockRestore();
  });
});
