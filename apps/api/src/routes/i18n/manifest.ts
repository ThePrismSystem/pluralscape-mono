import { I18N_CACHE_TTL_MS, type I18nManifest } from "@pluralscape/types";
import { Hono } from "hono";

import { HTTP_BAD_GATEWAY } from "../../http.constants.js";
import { logger } from "../../lib/logger.js";
import { envelope } from "../../lib/response.js";
import {
  CrowdinOtaService,
  CrowdinOtaTimeoutError,
  CrowdinOtaUpstreamError,
} from "../../services/crowdin-ota.service.js";

import type { ValkeyCache } from "../../lib/valkey-cache.js";

/** Cache key (scoped by ValkeyCache's namespace prefix). */
const MANIFEST_CACHE_KEY = "manifest";

/** Suffix Crowdin appends to every namespace filename. */
const NAMESPACE_FILE_SUFFIX = ".json";

interface ManifestRouteDeps {
  readonly ota: CrowdinOtaService;
  readonly cache: ValkeyCache;
}

/**
 * Shape of the Crowdin OTA `manifest.json` payload the service returns.
 * Declared here (not re-exported from the service) because this is the only
 * place the raw-to-envelope mapping happens — keeps the service honest and
 * the route self-contained.
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
 * Factory for the `GET /` handler under `/v1/i18n/manifest`.
 *
 * Deps are injected so unit tests can swap the OTA service and cache for
 * in-memory fakes without touching module-level state. The aggregator at
 * `routes/i18n/index.ts` is responsible for wiring the real deps.
 */
export function createManifestRoute(deps: ManifestRouteDeps): Hono {
  const app = new Hono();

  app.get("/", async (c) => {
    const cached = await deps.cache.getJSON<I18nManifest>(MANIFEST_CACHE_KEY);
    if (cached) return c.json(envelope(cached));

    try {
      const raw = (await deps.ota.fetchManifest()) satisfies CrowdinManifestRaw;
      const manifest = manifestFromCrowdin(raw);
      await deps.cache.setJSON(MANIFEST_CACHE_KEY, manifest, I18N_CACHE_TTL_MS);
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
  });

  return app;
}
