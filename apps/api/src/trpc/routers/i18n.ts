import { I18N_CACHE_TTL_MS, type I18nManifest, type I18nNamespace } from "@pluralscape/types";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { computeTranslationsEtag } from "../../lib/i18n-etag.js";
import {
  CrowdinOtaTimeoutError,
  CrowdinOtaUpstreamError,
  type CrowdinOtaService,
} from "../../services/crowdin-ota.service.js";
import { errorMapProcedure } from "../error-mapper.js";
import { createTRPCCategoryRateLimiter } from "../middlewares/rate-limit.js";
import { router } from "../trpc.js";

import type { ValkeyCache } from "../../lib/valkey-cache.js";

/** Cache key for the manifest within the i18n namespace. */
const MANIFEST_CACHE_KEY = "manifest";

/** Suffix Crowdin appends to every namespace filename. */
const NAMESPACE_FILE_SUFFIX = ".json";

/** Minimum accepted locale code length (e.g. "en", "pt-BR"). */
const MIN_LOCALE_LENGTH = 2;

/** HTTP 404 status — matches upstream CDN's "translation missing" response. */
const UPSTREAM_STATUS_NOT_FOUND = 404;

function namespaceCacheKey(locale: string, namespace: string): string {
  return `ns:${locale}:${namespace}`;
}

export interface I18nRouterDeps {
  readonly ota: CrowdinOtaService;
  readonly cache: ValkeyCache;
}

/**
 * Cached namespace envelope. The etag is computed once at cache-write time
 * so every cache hit avoids the canonical-JSON re-hash.
 */
interface CachedNamespace {
  readonly etag: string;
  readonly translations: Readonly<Record<string, string>>;
}

/**
 * Shape of the Crowdin OTA `manifest.json` payload. Declared here because
 * the tRPC router owns the raw-to-envelope mapping — mirrors the REST route.
 */
interface CrowdinManifestRaw {
  readonly timestamp: number;
  readonly content: Readonly<Record<string, readonly string[]>>;
}

/**
 * Map the raw Crowdin manifest into the flat `I18nManifest` shape consumed
 * by the mobile client. Per-namespace etags remain empty at the manifest
 * level — clients receive them via the `getNamespace` response.
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

function resolveDepsOrThrow(getDeps: () => I18nRouterDeps | null): I18nRouterDeps {
  const deps = getDeps();
  if (!deps) {
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "Translation source not configured",
    });
  }
  return deps;
}

function buildRouter(getDeps: () => I18nRouterDeps | null) {
  const i18nFetchLimiter = createTRPCCategoryRateLimiter("i18nFetch");

  return router({
    /**
     * Return the Crowdin distribution manifest. Public procedure — matches
     * the REST `GET /v1/i18n/manifest` route's unauthenticated surface.
     */
    getManifest: errorMapProcedure.use(i18nFetchLimiter).query(async (): Promise<I18nManifest> => {
      const deps = resolveDepsOrThrow(getDeps);

      const cached = await deps.cache.getJSON<I18nManifest>(MANIFEST_CACHE_KEY);
      if (cached) return cached;

      try {
        const raw = (await deps.ota.fetchManifest()) satisfies CrowdinManifestRaw;
        const manifest = manifestFromCrowdin(raw);
        await deps.cache.setJSON(MANIFEST_CACHE_KEY, manifest, I18N_CACHE_TTL_MS);
        return manifest;
      } catch (error: unknown) {
        if (error instanceof CrowdinOtaUpstreamError || error instanceof CrowdinOtaTimeoutError) {
          throw new TRPCError({
            code: "SERVICE_UNAVAILABLE",
            message: "Translation source unavailable",
            cause: error,
          });
        }
        throw error;
      }
    }),

    /**
     * Fetch a single locale/namespace pair. Returns translations alongside
     * the deterministic etag the client uses to short-circuit subsequent
     * fetches. Maps upstream 404 → NOT_FOUND and any other upstream
     * failure → SERVICE_UNAVAILABLE, mirroring the REST route's behaviour.
     */
    getNamespace: errorMapProcedure
      .use(i18nFetchLimiter)
      .input(
        z.object({
          locale: z.string().min(MIN_LOCALE_LENGTH),
          namespace: z.string().min(1),
        }),
      )
      .query(async ({ input }): Promise<I18nNamespace & { readonly etag: string }> => {
        const deps = resolveDepsOrThrow(getDeps);
        const key = namespaceCacheKey(input.locale, input.namespace);

        let cached = await deps.cache.getJSON<CachedNamespace>(key);

        if (!cached) {
          try {
            const translations = await deps.ota.fetchNamespace(input.locale, input.namespace);
            const etag = computeTranslationsEtag(translations);
            cached = { etag, translations };
            await deps.cache.setJSON(key, cached, I18N_CACHE_TTL_MS);
          } catch (error: unknown) {
            if (
              error instanceof CrowdinOtaUpstreamError &&
              error.status === UPSTREAM_STATUS_NOT_FOUND
            ) {
              throw new TRPCError({
                code: "NOT_FOUND",
                message: `Translation not found for ${input.locale}/${input.namespace}`,
                cause: error,
              });
            }
            if (
              error instanceof CrowdinOtaUpstreamError ||
              error instanceof CrowdinOtaTimeoutError
            ) {
              throw new TRPCError({
                code: "SERVICE_UNAVAILABLE",
                message: "Translation source unavailable",
                cause: error,
              });
            }
            throw error;
          }
        }

        return {
          etag: cached.etag,
          translations: cached.translations,
        };
      }),
  });
}

/**
 * Type of the i18n tRPC router. Exposed so the factory return type can be
 * declared explicitly for `@typescript-eslint/explicit-module-boundary-types`.
 */
export type I18nRouter = ReturnType<typeof buildRouter>;

/**
 * Build the i18n tRPC router.
 *
 * The deps getter is invoked lazily per request so callers can inject
 * memoized Valkey + Crowdin instances that are wired up during async app
 * bootstrap. Returning null from the getter causes procedures to fail with
 * SERVICE_UNAVAILABLE — matches the REST route's 503 `NOT_CONFIGURED` body.
 */
export function createI18nRouter(getDeps: () => I18nRouterDeps | null): I18nRouter {
  return buildRouter(getDeps);
}
