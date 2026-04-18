import { asEtag, type Etag, type I18nLocaleManifest, type I18nManifest } from "@pluralscape/types";

import { CrowdinOtaFailure } from "./crowdin-ota.service.js";

/**
 * Shared i18n constants and helpers used by both the REST route and the tRPC
 * router. Kept in a single module so `MANIFEST_CACHE_KEY`,
 * `NAMESPACE_FILE_SUFFIX`, `namespaceCacheKey`, and the raw-manifest
 * envelope-mapping live in one place — a change to cache-key shape or
 * filename-stripping logic propagates to both entry points atomically.
 */

/** Cache key (scoped by ValkeyCache's namespace prefix). */
export const MANIFEST_CACHE_KEY = "manifest";

/** Suffix Crowdin appends to every namespace filename. */
export const NAMESPACE_FILE_SUFFIX = ".json";

/**
 * Shape of the Crowdin OTA `manifest.json` payload the service returns.
 * Exposed here (rather than re-exported from the service) because the
 * raw-to-envelope mapping is an API-layer concern — the service only
 * guarantees the parsed shape, while this module owns the client contract.
 */
export interface CrowdinManifestRaw {
  readonly timestamp: number;
  readonly content: Readonly<Record<string, readonly string[]>>;
}

/**
 * Build the Valkey cache key for a single `locale/namespace` pair. Shared
 * between the REST and tRPC handlers so a mobile client hitting either
 * transport sees the same cached payload.
 */
export function namespaceCacheKey(locale: string, namespace: string): string {
  return `ns:${locale}:${namespace}`;
}

/**
 * Cached namespace envelope. The etag is computed once at cache-write time
 * so every cache hit avoids the canonical-JSON re-hash — and so the etag the
 * client compared against on the previous 200 matches what we compare here.
 * Shared between the REST and tRPC handlers for identical cache semantics.
 */
export interface CachedNamespace {
  readonly etag: Etag;
  readonly translations: Readonly<Record<string, string>>;
}

/**
 * Map the raw Crowdin manifest (keyed by locale -> [filenames]) into the
 * flat `I18nManifest` shape consumed by the mobile client. Per-namespace
 * etags are intentionally empty at the manifest level: clients receive them
 * via the `GET /:locale/:namespace` route's ETag header and the tRPC
 * `getNamespace` response field.
 *
 * A manifest with zero locales is a contract violation from upstream — we
 * surface it as `CrowdinOtaFailure({ kind: "malformed" })` so the REST
 * handler and tRPC router map it to their usual 502 / SERVICE_UNAVAILABLE.
 * This is also what lets `I18nManifest.locales` be typed as a non-empty
 * tuple: the check happens inside this boundary helper.
 */
export function manifestFromCrowdin(raw: CrowdinManifestRaw): I18nManifest {
  const entries = Object.entries(raw.content);
  const [firstEntry, ...restEntries] = entries;
  if (firstEntry === undefined) {
    throw new CrowdinOtaFailure({
      kind: "malformed",
      reason: "Crowdin manifest contains no locales",
    });
  }

  const toLocaleManifest = ([locale, files]: readonly [
    string,
    readonly string[],
  ]): I18nLocaleManifest => ({
    locale,
    namespaces: files.map((filename) => ({
      name: filename.endsWith(NAMESPACE_FILE_SUFFIX)
        ? filename.slice(0, -NAMESPACE_FILE_SUFFIX.length)
        : filename,
      etag: asEtag(""),
    })),
  });

  return {
    distributionTimestamp: raw.timestamp,
    locales: [toLocaleManifest(firstEntry), ...restEntries.map(toLocaleManifest)],
  };
}
