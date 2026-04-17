import { beforeEach, describe, expect, it, vi } from "vitest";

import { ValkeyCache, type ValkeyCacheClient } from "../../../lib/valkey-cache.js";
import {
  CrowdinOtaService,
  CrowdinOtaTimeoutError,
  CrowdinOtaUpstreamError,
} from "../../../services/crowdin-ota.service.js";
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

interface FakeOta {
  readonly svc: CrowdinOtaService;
  readonly fetchManifestMock: ReturnType<typeof vi.fn<CrowdinOtaService["fetchManifest"]>>;
  readonly fetchNamespaceMock: ReturnType<typeof vi.fn<CrowdinOtaService["fetchNamespace"]>>;
}

/**
 * Build a CrowdinOtaService instance using the real class so `instanceof`
 * checks inside the router still discriminate `CrowdinOtaUpstreamError` from
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
      fetchNamespace: () => Promise.reject(new CrowdinOtaUpstreamError("gone", 404)),
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
      fetchNamespace: () => Promise.reject(new CrowdinOtaUpstreamError("server err", 500)),
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
      fetchNamespace: () => Promise.reject(new CrowdinOtaTimeoutError(5_000)),
    });
    const c = makeCaller(
      createI18nRouter(() => ({ ota: otaTimeout.svc, cache: buildInMemoryCache() })),
    );
    await expect(c.getNamespace({ locale: "en", namespace: "x" })).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
    });
  });

  it("getManifest throws SERVICE_UNAVAILABLE on upstream failure", async () => {
    const otaDown = buildOta({
      fetchManifest: () => Promise.reject(new CrowdinOtaUpstreamError("server err", 500)),
    });
    const c = makeCaller(
      createI18nRouter(() => ({ ota: otaDown.svc, cache: buildInMemoryCache() })),
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
});
