import { env } from "../env.js";
import { InMemoryValkeyCacheClient, ValkeyCache } from "../lib/valkey-cache.js";
import { getSharedValkeyClient } from "../middleware/rate-limit.js";

import { CrowdinOtaService } from "./crowdin-ota.service.js";

const I18N_CACHE_NAMESPACE = "i18n";

/**
 * Shared deps injected into both the REST handlers and the tRPC router.
 *
 * Both transports resolve the same memoized instances via `getI18nDeps()`,
 * so a warm cache populated by a REST call is visible to a subsequent tRPC
 * call (and vice versa). Tests swap in in-memory fakes by constructing the
 * interface directly — `getI18nDeps` itself is only used at the outer
 * wiring layer.
 */
export interface I18nDeps {
  readonly ota: CrowdinOtaService;
  readonly cache: ValkeyCache;
}

/**
 * Module-level memo for the wired deps.
 *
 * We cannot build them at module-load time because `setSharedValkeyClient`
 * runs during async server startup, after this module has been imported by
 * the route aggregator and the tRPC composer. The getter is invoked lazily
 * on every request so the first request after startup sees a ready client;
 * subsequent requests reuse the cached deps without re-constructing the OTA
 * service or cache wrapper.
 */
let memoizedDeps: I18nDeps | null = null;

/**
 * Resolve the i18n deps if a Crowdin distribution hash is configured;
 * otherwise return null so the caller can emit the appropriate "not
 * configured" envelope (HTTP 503 / SERVICE_UNAVAILABLE).
 *
 * When a shared Valkey client is available, the cache is backed by it so
 * multi-instance deployments see coherent cached entries. When Valkey isn't
 * configured (single-instance / E2E), we fall back to an in-memory TTL map
 * — the contract is still "best-effort cache in front of a CDN", so losing
 * entries on restart is acceptable.
 */
export function getI18nDeps(): I18nDeps | null {
  if (memoizedDeps) return memoizedDeps;
  const hash = env.CROWDIN_DISTRIBUTION_HASH;
  if (!hash) return null;
  const sharedClient = getSharedValkeyClient();
  if (
    sharedClient === undefined &&
    env.NODE_ENV === "production" &&
    env.ALLOW_IN_MEMORY_CACHE !== "1"
  ) {
    throw new Error(
      "valkey-cache: VALKEY_URL is unset in NODE_ENV=production. " +
        "Configure a shared Valkey/Redis endpoint, or set ALLOW_IN_MEMORY_CACHE=1 to explicitly opt in to " +
        "per-process caching (only safe for single-instance deployments).",
    );
  }
  const cacheClient = sharedClient ?? new InMemoryValkeyCacheClient();
  memoizedDeps = {
    ota: new CrowdinOtaService({
      distributionHash: hash,
      baseUrl: env.CROWDIN_OTA_BASE_URL,
    }),
    cache: new ValkeyCache(cacheClient, I18N_CACHE_NAMESPACE),
  };
  return memoizedDeps;
}

/**
 * Test-only: drop the memoized deps so each test starts fresh. Prevents
 * cross-test leakage when one test mutates env / Valkey slots. Both the
 * REST route module and the tRPC composer re-export this under their own
 * aliased names for backwards-compatible test harnesses.
 */
export function _resetI18nDepsForTesting(): void {
  memoizedDeps = null;
}
