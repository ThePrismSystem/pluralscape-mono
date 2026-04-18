import { beforeEach, describe, expect, it, vi } from "vitest";

import { logger } from "../../../lib/logger.js";
import { ValkeyCache, type ValkeyCacheClient } from "../../../lib/valkey-cache.js";
import { CrowdinOtaFailure, CrowdinOtaService } from "../../../services/crowdin-ota.service.js";
import { createI18nRouter } from "../../../trpc/routers/i18n.js";
import { createCallerFactory } from "../../../trpc/trpc.js";
import { makeContext } from "../test-helpers.js";

vi.mock("../../../middleware/rate-limit.js", async () => {
  const actual = await vi.importActual<typeof import("../../../middleware/rate-limit.js")>(
    "../../../middleware/rate-limit.js",
  );
  return {
    ...actual,
    checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
  };
});

/**
 * Minimal in-memory ValkeyCacheClient. Matches the `(key, value, "PX", ttlMs)`
 * overload — TTL is intentionally ignored because unit tests here never span
 * the expiry window.
 */
function buildInMemoryCache(): ValkeyCache {
  const store = new Map<string, string>();
  const client: ValkeyCacheClient = {
    get: (k) => Promise.resolve(store.get(k) ?? null),
    set: (k, v) => {
      store.set(k, v);
      return Promise.resolve("OK");
    },
    del: (k) => Promise.resolve(store.delete(k) ? 1 : 0),
  };
  return new ValkeyCache(client, "test");
}

/**
 * Cache whose writes always fail. Exercises the `trySetJSON` best-effort
 * path: a Valkey disconnect after a successful upstream fetch must NOT
 * propagate as a 500 / INTERNAL_SERVER_ERROR.
 */
function buildCacheWithFailingSet(): ValkeyCache {
  const client: ValkeyCacheClient = {
    get: () => Promise.resolve(null),
    set: () => Promise.reject(new Error("connection lost")),
    del: () => Promise.resolve(0),
  };
  return new ValkeyCache(client, "test");
}

interface FakeOta {
  readonly svc: CrowdinOtaService;
  readonly fetchManifestMock: ReturnType<typeof vi.fn<CrowdinOtaService["fetchManifest"]>>;
  readonly fetchNamespaceMock: ReturnType<typeof vi.fn<CrowdinOtaService["fetchNamespace"]>>;
}

/**
 * Build a CrowdinOtaService instance using the real class so `instanceof`
 * checks inside the router still discriminate `CrowdinOtaFailure` variants from
 * other failures. We override `fetchManifest` / `fetchNamespace` directly —
 * private fields are declaration-only under TS `private`, so the instance is
 * structurally complete for the router's usage. The mocks are returned
 * alongside the service so assertions don't need to read methods off the
 * instance (which would trigger `@typescript-eslint/unbound-method`).
 */
function buildOta(overrides?: {
  fetchManifest?: CrowdinOtaService["fetchManifest"];
  fetchNamespace?: CrowdinOtaService["fetchNamespace"];
}): FakeOta {
  const svc = new CrowdinOtaService({
    distributionHash: "test-hash",
    fetch: () => Promise.reject(new Error("fetch should be overridden")),
  });
  const defaultManifest: CrowdinOtaService["fetchManifest"] = () =>
    Promise.resolve({ timestamp: 1, content: { en: ["common.json"] } });
  const defaultNamespace: CrowdinOtaService["fetchNamespace"] = () =>
    Promise.resolve({ greeting: "Hi" });
  const fetchManifestMock = vi.fn<CrowdinOtaService["fetchManifest"]>(
    overrides?.fetchManifest ?? defaultManifest,
  );
  const fetchNamespaceMock = vi.fn<CrowdinOtaService["fetchNamespace"]>(
    overrides?.fetchNamespace ?? defaultNamespace,
  );
  svc.fetchManifest = fetchManifestMock;
  svc.fetchNamespace = fetchNamespaceMock;
  return { svc, fetchManifestMock, fetchNamespaceMock };
}

function makeCaller(router: ReturnType<typeof createI18nRouter>) {
  const createCaller = createCallerFactory(router);
  return createCaller(makeContext(null));
}

describe("i18n tRPC router", () => {
  let ota: FakeOta;
  let cache: ValkeyCache;
  let caller: ReturnType<typeof makeCaller>;

  beforeEach(() => {
    ota = buildOta();
    cache = buildInMemoryCache();
    caller = makeCaller(createI18nRouter(() => ({ ota: ota.svc, cache })));
  });

  it("getManifest returns manifest shape", async () => {
    const out = await caller.getManifest();
    expect(out.distributionTimestamp).toBe(1);
    expect(out.locales[0]?.locale).toBe("en");
    expect(out.locales[0]?.namespaces[0]?.name).toBe("common");
  });

  it("getManifest caches repeat calls", async () => {
    await caller.getManifest();
    await caller.getManifest();
    expect(ota.fetchManifestMock).toHaveBeenCalledTimes(1);
  });

  it("getNamespace returns translations + etag", async () => {
    const out = await caller.getNamespace({ locale: "en", namespace: "common" });
    expect(out.translations).toEqual({ greeting: "Hi" });
    expect(out.etag).toMatch(/^[0-9a-f]{16}$/);
  });

  it("getNamespace caches repeat calls", async () => {
    await caller.getNamespace({ locale: "en", namespace: "common" });
    await caller.getNamespace({ locale: "en", namespace: "common" });
    expect(ota.fetchNamespaceMock).toHaveBeenCalledTimes(1);
  });

  it("getNamespace throws NOT_FOUND on upstream 404", async () => {
    const ota404 = buildOta({
      fetchNamespace: () =>
        Promise.reject(new CrowdinOtaFailure({ kind: "upstream", status: 404, message: "gone" })),
    });
    const c = makeCaller(
      createI18nRouter(() => ({ ota: ota404.svc, cache: buildInMemoryCache() })),
    );
    await expect(c.getNamespace({ locale: "en", namespace: "x" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("getNamespace throws SERVICE_UNAVAILABLE on generic upstream failure", async () => {
    const ota500 = buildOta({
      fetchNamespace: () =>
        Promise.reject(
          new CrowdinOtaFailure({ kind: "upstream", status: 500, message: "server err" }),
        ),
    });
    const c = makeCaller(
      createI18nRouter(() => ({ ota: ota500.svc, cache: buildInMemoryCache() })),
    );
    await expect(c.getNamespace({ locale: "en", namespace: "x" })).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
    });
  });

  it("getNamespace throws SERVICE_UNAVAILABLE on upstream timeout", async () => {
    const otaTimeout = buildOta({
      fetchNamespace: () =>
        Promise.reject(new CrowdinOtaFailure({ kind: "timeout", timeoutMs: 5_000 })),
    });
    const c = makeCaller(
      createI18nRouter(() => ({ ota: otaTimeout.svc, cache: buildInMemoryCache() })),
    );
    await expect(c.getNamespace({ locale: "en", namespace: "x" })).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
    });
  });

  // Boundary coverage for the `malformed` variant on getNamespace: Crowdin
  // responded 200 but the parsed body failed service-level validation. The
  // router must surface SERVICE_UNAVAILABLE, not NOT_FOUND — the namespace
  // may well exist, just with a broken shape.
  it("getNamespace throws SERVICE_UNAVAILABLE on malformed Crowdin payload", async () => {
    const otaMalformed = buildOta({
      fetchNamespace: () =>
        Promise.reject(new CrowdinOtaFailure({ kind: "malformed", reason: "bad shape" })),
    });
    const c = makeCaller(
      createI18nRouter(() => ({ ota: otaMalformed.svc, cache: buildInMemoryCache() })),
    );
    await expect(c.getNamespace({ locale: "en", namespace: "x" })).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
    });
  });

  it("getManifest throws SERVICE_UNAVAILABLE on upstream failure", async () => {
    const otaDown = buildOta({
      fetchManifest: () =>
        Promise.reject(
          new CrowdinOtaFailure({ kind: "upstream", status: 500, message: "server err" }),
        ),
    });
    const c = makeCaller(
      createI18nRouter(() => ({ ota: otaDown.svc, cache: buildInMemoryCache() })),
    );
    await expect(c.getManifest()).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
    });
  });

  // Boundary coverage for the `timeout` variant on getManifest: AbortError
  // from the underlying fetch must map to SERVICE_UNAVAILABLE at the tRPC
  // boundary (same end-user effect as REST's 502 UPSTREAM_UNAVAILABLE).
  it("getManifest throws SERVICE_UNAVAILABLE on upstream timeout", async () => {
    const otaTimeout = buildOta({
      fetchManifest: () =>
        Promise.reject(new CrowdinOtaFailure({ kind: "timeout", timeoutMs: 5_000 })),
    });
    const c = makeCaller(
      createI18nRouter(() => ({ ota: otaTimeout.svc, cache: buildInMemoryCache() })),
    );
    await expect(c.getManifest()).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
    });
  });

  // Boundary coverage for the `malformed` variant on getManifest: Crowdin
  // returned a 200 but the body shape failed schema validation. The router
  // must still surface SERVICE_UNAVAILABLE — the client cannot proceed.
  it("getManifest throws SERVICE_UNAVAILABLE on malformed Crowdin payload", async () => {
    const otaMalformed = buildOta({
      fetchManifest: () =>
        Promise.reject(new CrowdinOtaFailure({ kind: "malformed", reason: "bad shape" })),
    });
    const c = makeCaller(
      createI18nRouter(() => ({ ota: otaMalformed.svc, cache: buildInMemoryCache() })),
    );
    await expect(c.getManifest()).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
    });
  });

  it("getManifest throws SERVICE_UNAVAILABLE when deps getter returns null", async () => {
    const c = makeCaller(createI18nRouter(() => null));
    await expect(c.getManifest()).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
  });

  it("getNamespace throws SERVICE_UNAVAILABLE when deps getter returns null", async () => {
    const c = makeCaller(createI18nRouter(() => null));
    await expect(c.getNamespace({ locale: "en", namespace: "common" })).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
    });
  });

  it("logs a warn line when the upstream manifest fetch fails", async () => {
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    const otaDown = buildOta({
      fetchManifest: () =>
        Promise.reject(
          new CrowdinOtaFailure({ kind: "upstream", status: 500, message: "server err" }),
        ),
    });
    const c = makeCaller(
      createI18nRouter(() => ({ ota: otaDown.svc, cache: buildInMemoryCache() })),
    );
    await expect(c.getManifest()).rejects.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(
      "crowdin manifest fetch failed",
      expect.objectContaining({ error: expect.any(String) }),
    );
    warnSpy.mockRestore();
  });

  it("logs a warn line when the upstream namespace fetch fails", async () => {
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    const otaDown = buildOta({
      fetchNamespace: () =>
        Promise.reject(
          new CrowdinOtaFailure({ kind: "upstream", status: 500, message: "server err" }),
        ),
    });
    const c = makeCaller(
      createI18nRouter(() => ({ ota: otaDown.svc, cache: buildInMemoryCache() })),
    );
    await expect(c.getNamespace({ locale: "es", namespace: "common" })).rejects.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(
      "crowdin namespace fetch failed",
      expect.objectContaining({
        error: expect.any(String),
        locale: "es",
        namespace: "common",
      }),
    );
    warnSpy.mockRestore();
  });

  // Regression guard: cache-write failure after a successful upstream fetch
  // must NOT re-enter the upstream error branch (and therefore must NOT
  // surface as SERVICE_UNAVAILABLE / INTERNAL_SERVER_ERROR). Asserts the
  // fresh manifest is returned and the best-effort log line is emitted.
  it("getManifest returns manifest even when cache write fails (best-effort)", async () => {
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    const failingCache = buildCacheWithFailingSet();
    const c = makeCaller(createI18nRouter(() => ({ ota: ota.svc, cache: failingCache })));
    const out = await c.getManifest();
    expect(out.distributionTimestamp).toBe(1);
    expect(out.locales[0]?.locale).toBe("en");
    expect(warnSpy).toHaveBeenCalledWith(
      "valkey-cache: setJSON failed, continuing",
      expect.objectContaining({ error: "connection lost" }),
    );
    warnSpy.mockRestore();
  });

  it("getNamespace returns translations even when cache write fails (best-effort)", async () => {
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    const failingCache = buildCacheWithFailingSet();
    const c = makeCaller(createI18nRouter(() => ({ ota: ota.svc, cache: failingCache })));
    const out = await c.getNamespace({ locale: "en", namespace: "common" });
    expect(out.translations).toEqual({ greeting: "Hi" });
    expect(out.etag).toMatch(/^[0-9a-f]{16}$/);
    expect(warnSpy).toHaveBeenCalledWith(
      "valkey-cache: setJSON failed, continuing",
      expect.objectContaining({ error: "connection lost" }),
    );
    warnSpy.mockRestore();
  });
});
