import { I18N_CACHE_TTL_MS, type I18nNamespace } from "@pluralscape/types";

import { HTTP_BAD_GATEWAY, HTTP_NOT_FOUND, HTTP_NOT_MODIFIED } from "../../http.constants.js";
import { computeTranslationsEtag } from "../../lib/i18n-etag.js";
import { requireParam } from "../../lib/id-param.js";
import { logger } from "../../lib/logger.js";
import { envelope } from "../../lib/response.js";
import {
  CrowdinOtaTimeoutError,
  CrowdinOtaUpstreamError,
} from "../../services/crowdin-ota.service.js";

import type { I18nDeps } from "./manifest.js";
import type { Context } from "hono";

/** HTTP 404 from upstream — maps to our own 404 response for missing locale/namespace. */
const UPSTREAM_STATUS_NOT_FOUND = 404;

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

  const key = cacheKey(locale, namespace);
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
      if (error instanceof CrowdinOtaUpstreamError && error.status === UPSTREAM_STATUS_NOT_FOUND) {
        return c.json(
          { error: { code: "NAMESPACE_NOT_FOUND", message: "Translation not found" } },
          HTTP_NOT_FOUND,
        );
      }
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
}
