import { env } from "../../env.js";
import { ValkeyCache } from "../../lib/valkey-cache.js";
import { getSharedValkeyClient } from "../../middleware/rate-limit.js";
import { CrowdinOtaService } from "../../services/crowdin-ota.service.js";

import { createI18nRouter, type I18nRouterDeps } from "./i18n.js";

/** Namespace under which i18n entries live inside the shared ValkeyCache. */
const I18N_CACHE_NAMESPACE = "i18n";

/**
 * Module-level memo for wired deps.
 *
 * We cannot build them at module-load time because `setSharedValkeyClient`
 * runs during async server startup, after this module has been imported by
 * `root.ts`. The getter is invoked lazily from inside each procedure so the
 * first request after startup sees a ready client. Subsequent requests reuse
 * the cached deps without re-constructing the OTA service or cache wrapper.
 */
let memoizedDeps: I18nRouterDeps | null = null;

function getI18nDeps(): I18nRouterDeps | null {
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
export function _resetI18nComposerDepsForTesting(): void {
  memoizedDeps = null;
}

export const i18nRouter = createI18nRouter(getI18nDeps);
