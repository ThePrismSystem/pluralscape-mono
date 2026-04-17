import { Hono, type Context } from "hono";

import { env } from "../../env.js";
import { HTTP_SERVICE_UNAVAILABLE } from "../../http.constants.js";
import { ValkeyCache } from "../../lib/valkey-cache.js";
import { createCategoryRateLimiter, getSharedValkeyClient } from "../../middleware/rate-limit.js";
import { CrowdinOtaService } from "../../services/crowdin-ota.service.js";

import { createManifestRoute } from "./manifest.js";
import { createNamespaceRoute } from "./namespace.js";

/** Namespace under which i18n entries live inside the shared ValkeyCache. */
const I18N_CACHE_NAMESPACE = "i18n";

interface MountedRoutes {
  readonly manifest: Hono;
  readonly namespace: Hono;
}

/**
 * Module-level memo for the wired sub-apps. We cannot build them at module
 * load time because `setSharedValkeyClient` is called asynchronously during
 * server startup, after `v1Routes` has already been imported. So we resolve
 * deps on the first request (lazily) and cache the constructed handlers
 * for every subsequent request.
 */
let memoizedRoutes: MountedRoutes | null = null;

/**
 * Resolve the i18n sub-apps if both the shared Valkey client and the
 * Crowdin distribution hash are available; otherwise return null so the
 * caller can emit a 503. Constructing the apps once and caching them keeps
 * per-request allocation flat.
 */
function getMountedRoutes(): MountedRoutes | null {
  if (memoizedRoutes) return memoizedRoutes;

  const client = getSharedValkeyClient();
  const hash = env.CROWDIN_DISTRIBUTION_HASH;
  if (!client || !hash) return null;

  const deps = {
    ota: new CrowdinOtaService({ distributionHash: hash }),
    cache: new ValkeyCache(client, I18N_CACHE_NAMESPACE),
  };
  memoizedRoutes = {
    manifest: createManifestRoute(deps),
    namespace: createNamespaceRoute(deps),
  };
  return memoizedRoutes;
}

/**
 * Test-only: drop the memoized deps so each test starts fresh. Prevents
 * cross-test leakage when one test mutates env / Valkey slots.
 */
export function _resetI18nDepsForTesting(): void {
  memoizedRoutes = null;
}

/** Standard 503 envelope for when i18n deps aren't configured yet. */
function notConfiguredResponse(c: Context): Response {
  return c.json(
    {
      error: {
        code: "NOT_CONFIGURED",
        message: "Crowdin distribution not configured",
      },
    },
    HTTP_SERVICE_UNAVAILABLE,
  );
}

export const i18nRoutes = new Hono();

// Rate-limit every i18n fetch. The category config lives in packages/types.
i18nRoutes.use("*", createCategoryRateLimiter("i18nFetch"));

// Lazy dispatch — deps are resolved on each request but memoized on first hit.
i18nRoutes.get("/manifest", (c) => {
  const routes = getMountedRoutes();
  if (!routes) return notConfiguredResponse(c);
  return routes.manifest.fetch(c.req.raw);
});

i18nRoutes.get("/:locale/:namespace", (c) => {
  const routes = getMountedRoutes();
  if (!routes) return notConfiguredResponse(c);
  return routes.namespace.fetch(c.req.raw);
});
