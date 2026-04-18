import { I18N_CACHE_TTL_MS, type I18nManifest } from "@pluralscape/types";

import { HTTP_BAD_GATEWAY } from "../../http.constants.js";
import { logger } from "../../lib/logger.js";
import { envelope } from "../../lib/response.js";
import {
  CrowdinOtaService,
  CrowdinOtaTimeoutError,
  CrowdinOtaUpstreamError,
} from "../../services/crowdin-ota.service.js";

import type { ValkeyCache } from "../../lib/valkey-cache.js";
import type { Context } from "hono";

/** Cache key (scoped by ValkeyCache's namespace prefix). */
const MANIFEST_CACHE_KEY = "manifest";

/** Suffix Crowdin appends to every namespace filename. */
const NAMESPACE_FILE_SUFFIX = ".json";

/**
 * Shared deps injected into the i18n handlers.
 *
 * The outer route aggregator resolves real Valkey + Crowdin instances once
 * per process and passes them through on every request; tests swap in
 * in-memory fakes so the handlers stay hermetic.
 */
export interface I18nDeps {
  readonly ota: CrowdinOtaService;
  readonly cache: ValkeyCache;
}

/**
 * Shape of the Crowdin OTA `manifest.json` payload the service returns.
 * Declared here (not re-exported from the service) because this is the only
 * place the raw-to-envelope mapping happens — keeps the service honest and
 * the handler self-contained.
 */
interface CrowdinManifestRaw {
  readonly timestamp: number;
  readonly content: Readonly<Record<string, readonly string[]>>;
}

/**
 * Map the raw Crowdin manifest (keyed by locale -> [filenames]) into the
 * flat `I18nManifest` shape consumed by the mobile client. The etag is
 * intentionally empty at the manifest level: clients receive per-namespace
 * etags via the `GET /:locale/:namespace` route's ETag header.
 */
function manifestFromCrowdin(raw: CrowdinManifestRaw): I18nManifest {
  return {
    distributionTimestamp: raw.timestamp,
    locales: Object.entries(raw.content).map(([locale, files]) => ({
      locale,
      namespaces: files.map((filename) => ({
        name: filename.endsWith(NAMESPACE_FILE_SUFFIX)
          ? filename.slice(0, -NAMESPACE_FILE_SUFFIX.length)
          : filename,
        etag: "",
      })),
    })),
  };
}

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
    if (error instanceof CrowdinOtaUpstreamError || error instanceof CrowdinOtaTimeoutError) {
      return c.json(
        { error: { code: "UPSTREAM_UNAVAILABLE", message: "Translation source unavailable" } },
        HTTP_BAD_GATEWAY,
      );
    }
    throw error;
  }
}
