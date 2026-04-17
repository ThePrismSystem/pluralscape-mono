import { I18N_CACHE_TTL_MS, type I18nNamespace } from "@pluralscape/types";
import { Hono } from "hono";

import { HTTP_BAD_GATEWAY, HTTP_NOT_MODIFIED } from "../../http.constants.js";
import { computeTranslationsEtag } from "../../lib/i18n-etag.js";
import { logger } from "../../lib/logger.js";
import { envelope } from "../../lib/response.js";
import {
  CrowdinOtaService,
  CrowdinOtaTimeoutError,
  CrowdinOtaUpstreamError,
} from "../../services/crowdin-ota.service.js";

import type { ValkeyCache } from "../../lib/valkey-cache.js";

interface NamespaceRouteDeps {
  readonly ota: CrowdinOtaService;
  readonly cache: ValkeyCache;
}

/**
 * Cached namespace envelope. The etag is computed once at cache-write time
 * so every 304 hit avoids the canonical-JSON re-hash — and so the etag the
 * client compared against on the previous 200 matches what we compare here.
 */
interface CachedNamespace {
  readonly etag: string;
  readonly translations: Readonly<Record<string, string>>;
}

function cacheKey(locale: string, namespace: string): string {
  return `ns:${locale}:${namespace}`;
}

/**
 * Factory for the `GET /:locale/:namespace` handler under `/v1/i18n`.
 *
 * ETag / If-None-Match semantics:
 *  - On every 200 we emit a quoted ETag (RFC 7232 strong validator).
 *  - We also emit `Cache-Control: public, max-age=0, must-revalidate`,
 *    which forces clients to revalidate every time rather than silently
 *    serve stale translations, while still allowing the CDN/proxy layer
 *    to cache the 200 body keyed by URL.
 *  - An incoming If-None-Match that matches the current etag short-circuits
 *    to 304 with an empty body (per RFC 7232 § 4.1).
 */
export function createNamespaceRoute(deps: NamespaceRouteDeps): Hono {
  const app = new Hono();

  app.get("/:locale/:namespace", async (c) => {
    const locale = c.req.param("locale");
    const namespace = c.req.param("namespace");
    const ifNoneMatch = c.req.header("if-none-match");

    const key = cacheKey(locale, namespace);
    let cached = await deps.cache.getJSON<CachedNamespace>(key);

    if (!cached) {
      try {
        const translations = await deps.ota.fetchNamespace(locale, namespace);
        const etag = computeTranslationsEtag(translations);
        cached = { etag, translations };
        await deps.cache.setJSON(key, cached, I18N_CACHE_TTL_MS);
      } catch (error: unknown) {
        logger.warn("crowdin namespace fetch failed", {
          error: error instanceof Error ? error.message : String(error),
          locale,
          namespace,
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

    const quotedEtag = `"${cached.etag}"`;
    c.header("ETag", quotedEtag);
    c.header("Cache-Control", "public, max-age=0, must-revalidate");

    if (ifNoneMatch && ifNoneMatch === quotedEtag) {
      return c.body(null, HTTP_NOT_MODIFIED);
    }

    const body: I18nNamespace = { translations: cached.translations };
    return c.json(envelope(body));
  });

  return app;
}
