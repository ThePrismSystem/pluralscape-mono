import { I18N_CACHE_TTL_MS, type I18nManifest } from "@pluralscape/types";

import { HTTP_BAD_GATEWAY } from "../../http.constants.js";
import { logger } from "../../lib/logger.js";
import { envelope } from "../../lib/response.js";
import { CrowdinOtaFailure } from "../../services/crowdin-ota.service.js";
import {
  MANIFEST_CACHE_KEY,
  manifestFromCrowdin,
  type CrowdinManifestRaw,
} from "../../services/i18n-shared.js";

import type { I18nDeps } from "../../services/i18n-deps.js";
import type { Context } from "hono";

/**
 * Handle `GET /v1/i18n/manifest`.
 *
 * The surrounding route registers this handler directly against `i18nRoutes`
 * (no intermediate Hono sub-app), so `c.req.raw` carries the full path and
 * inner route matching is avoided entirely. A cache-write failure is logged
 * but does NOT turn a successful upstream fetch into a 5xx response.
 */
export async function handleManifest(c: Context, deps: I18nDeps): Promise<Response> {
  const cached = await deps.cache.getJSON<I18nManifest>(MANIFEST_CACHE_KEY);
  if (cached) return c.json(envelope(cached));

  try {
    const raw = (await deps.ota.fetchManifest()) satisfies CrowdinManifestRaw;
    const manifest = manifestFromCrowdin(raw);
    await deps.cache.trySetJSON(MANIFEST_CACHE_KEY, manifest, I18N_CACHE_TTL_MS);
    return c.json(envelope(manifest));
  } catch (error: unknown) {
    logger.warn("crowdin manifest fetch failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    if (error instanceof CrowdinOtaFailure) {
      switch (error.detail.kind) {
        case "timeout":
        case "upstream":
        case "malformed":
          return c.json(
            { error: { code: "UPSTREAM_UNAVAILABLE", message: "Translation source unavailable" } },
            HTTP_BAD_GATEWAY,
          );
        default:
          return error.detail satisfies never;
      }
    }
    throw error;
  }
}
