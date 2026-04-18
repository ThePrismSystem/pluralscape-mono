import { I18N_CACHE_TTL_MS, type I18nNamespace } from "@pluralscape/types";

import { HTTP_BAD_GATEWAY, HTTP_NOT_FOUND, HTTP_NOT_MODIFIED } from "../../http.constants.js";
import { computeTranslationsEtag } from "../../lib/i18n-etag.js";
import { requireParam } from "../../lib/id-param.js";
import { logger } from "../../lib/logger.js";
import { envelope } from "../../lib/response.js";
import { CrowdinOtaFailure } from "../../services/crowdin-ota.service.js";
import { namespaceCacheKey, type CachedNamespace } from "../../services/i18n-shared.js";

import type { I18nDeps } from "../../services/i18n-deps.js";
import type { Context } from "hono";

/** HTTP 404 from upstream — maps to our own 404 response for missing locale/namespace. */
const UPSTREAM_STATUS_NOT_FOUND = 404;

/**
 * Handle `GET /v1/i18n/:locale/:namespace`.
 *
 * ETag semantics: every 200 emits a quoted strong validator. An incoming
 * `If-None-Match` that matches the current etag short-circuits to 304 with
 * an empty body (RFC 7232 §4.1). `Cache-Control: must-revalidate` forces
 * clients to revalidate on every request rather than silently serve stale
 * translations, while still allowing the CDN/proxy layer to cache the 200
 * body keyed by URL.
 *
 * Upstream 404 passes through as our own 404 (`NAMESPACE_NOT_FOUND`); any
 * other upstream failure surfaces as 502 (`UPSTREAM_UNAVAILABLE`). A cache
 * write failure is logged but does NOT turn a successful fetch into a 5xx.
 */
export async function handleNamespace(c: Context, deps: I18nDeps): Promise<Response> {
  // `Context` without a path-generic types `req.param` as `string | undefined`.
  // These params are present by virtue of the route's path spec, but we
  // validate anyway so a future misconfiguration surfaces as a 400 rather
  // than an unchecked undefined flowing into Crowdin URLs.
  const locale = requireParam(c.req.param("locale"), "locale");
  const namespace = requireParam(c.req.param("namespace"), "namespace");
  const ifNoneMatch = c.req.header("if-none-match");

  const key = namespaceCacheKey(locale, namespace);
  let cached = await deps.cache.getJSON<CachedNamespace>(key);

  if (!cached) {
    try {
      const translations = await deps.ota.fetchNamespace(locale, namespace);
      const etag = computeTranslationsEtag(translations);
      cached = { etag, translations };
      await deps.cache.trySetJSON(key, cached, I18N_CACHE_TTL_MS);
    } catch (error: unknown) {
      logger.warn("crowdin namespace fetch failed", {
        error: error instanceof Error ? error.message : String(error),
        locale,
        namespace,
      });
      if (error instanceof CrowdinOtaFailure) {
        switch (error.detail.kind) {
          case "upstream":
            if (error.detail.status === UPSTREAM_STATUS_NOT_FOUND) {
              return c.json(
                { error: { code: "NAMESPACE_NOT_FOUND", message: "Translation not found" } },
                HTTP_NOT_FOUND,
              );
            }
            return c.json(
              {
                error: { code: "UPSTREAM_UNAVAILABLE", message: "Translation source unavailable" },
              },
              HTTP_BAD_GATEWAY,
            );
          case "timeout":
          case "malformed":
            return c.json(
              {
                error: { code: "UPSTREAM_UNAVAILABLE", message: "Translation source unavailable" },
              },
              HTTP_BAD_GATEWAY,
            );
          default:
            return error.detail satisfies never;
        }
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
}
