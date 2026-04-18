import { Hono, type Context } from "hono";

import { env } from "../../env.js";
import { HTTP_SERVICE_UNAVAILABLE } from "../../http.constants.js";
import { ValkeyCache } from "../../lib/valkey-cache.js";
import { createCategoryRateLimiter, getSharedValkeyClient } from "../../middleware/rate-limit.js";
import { CrowdinOtaService } from "../../services/crowdin-ota.service.js";

import { handleManifest, type I18nDeps } from "./manifest.js";
import { handleNamespace } from "./namespace.js";

/** Namespace under which i18n entries live inside the shared ValkeyCache. */
const I18N_CACHE_NAMESPACE = "i18n";

/**
 * Module-level memo for the wired deps. We cannot build them at module load
 * time because `setSharedValkeyClient` is called asynchronously during server
 * startup, after `v1Routes` has already been imported. So we resolve deps on
 * the first request (lazily) and cache them for every subsequent request.
 */
let memoizedDeps: I18nDeps | null = null;

/**
 * Resolve the i18n deps if both the shared Valkey client and the Crowdin
 * distribution hash are available; otherwise return null so the caller can
 * emit a 503. Constructing the deps once and caching keeps per-request
 * allocation flat.
 */
function getMountedDeps(): I18nDeps | null {
  if (memoizedDeps) return memoizedDeps;

  const client = getSharedValkeyClient();
  const hash = env.CROWDIN_DISTRIBUTION_HASH;
  if (!client || !hash) return null;

  memoizedDeps = {
    ota: new CrowdinOtaService({ distributionHash: hash }),
    cache: new ValkeyCache(client, I18N_CACHE_NAMESPACE),
  };
  return memoizedDeps;
}

/**
 * Test-only: drop the memoized deps so each test starts fresh. Prevents
 * cross-test leakage when one test mutates env / Valkey slots.
 */
export function _resetI18nDepsForTesting(): void {
  memoizedDeps = null;
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

// Handlers are registered directly on this Hono instance (no nested sub-app
// .fetch()) so the outer path parameters are available via `c.req.param(...)`
// without a secondary route-match pass — the earlier nested-dispatch design
// 404'd in production because the inner app saw the full `/v1/i18n/...` path.
i18nRoutes.get("/manifest", (c) => {
  const deps = getMountedDeps();
  if (!deps) return notConfiguredResponse(c);
  return handleManifest(c, deps);
});

i18nRoutes.get("/:locale/:namespace", (c) => {
  const deps = getMountedDeps();
  if (!deps) return notConfiguredResponse(c);
  return handleNamespace(c, deps);
});
