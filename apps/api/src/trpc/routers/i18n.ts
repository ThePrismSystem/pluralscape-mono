import {
  I18N_CACHE_TTL_MS,
  type I18nManifest,
  type I18nNamespaceWithEtag,
} from "@pluralscape/types";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { computeTranslationsEtag } from "../../lib/i18n-etag.js";
import { logger } from "../../lib/logger.js";
import { LocaleSchema, NamespaceSchema } from "../../routes/i18n/schemas.js";
import { CrowdinOtaFailure } from "../../services/crowdin-ota.service.js";
import {
  MANIFEST_CACHE_KEY,
  manifestFromCrowdin,
  namespaceCacheKey,
  type CachedNamespace,
  type CrowdinManifestRaw,
} from "../../services/i18n-shared.js";
import { errorMapProcedure } from "../error-mapper.js";
import { createTRPCCategoryRateLimiter } from "../middlewares/rate-limit.js";
import { router } from "../trpc.js";

import type { I18nDeps } from "../../services/i18n-deps.js";

/**
 * Alias kept for call-site clarity — the underlying interface is the shared
 * `I18nDeps` that both the REST route and the tRPC router consume. A type
 * alias rather than a `re-export` because consumers of this module import
 * `I18nRouterDeps` as a positional name.
 */
export type I18nRouterDeps = I18nDeps;

/** Upstream 404 from Crowdin — maps to tRPC NOT_FOUND at the boundary. */
const UPSTREAM_STATUS_NOT_FOUND = 404;

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

/**
 * Map a `CrowdinOtaFailure` to the appropriate `TRPCError`. The input is
 * forwarded verbatim on non-failure errors so the caller can decide whether
 * to rethrow. Upstream 404 is distinguished so `getNamespace` can surface
 * NOT_FOUND; every other failure mode (timeout, generic upstream, malformed
 * payload) maps to SERVICE_UNAVAILABLE, matching the REST route's 502.
 */
function trpcErrorFromFailure(failure: CrowdinOtaFailure, notFoundMessage?: string): TRPCError {
  switch (failure.detail.kind) {
    case "upstream":
      if (failure.detail.status === UPSTREAM_STATUS_NOT_FOUND && notFoundMessage !== undefined) {
        return new TRPCError({
          code: "NOT_FOUND",
          message: notFoundMessage,
          cause: failure,
        });
      }
      return new TRPCError({
        code: "SERVICE_UNAVAILABLE",
        message: "Translation source unavailable",
        cause: failure,
      });
    case "timeout":
    case "malformed":
      return new TRPCError({
        code: "SERVICE_UNAVAILABLE",
        message: "Translation source unavailable",
        cause: failure,
      });
    default:
      return failure.detail satisfies never;
  }
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

      let manifest: I18nManifest;
      try {
        const raw = (await deps.ota.fetchManifest()) satisfies CrowdinManifestRaw;
        manifest = manifestFromCrowdin(raw);
      } catch (error: unknown) {
        logger.warn("crowdin manifest fetch failed", {
          error: error instanceof Error ? error.message : String(error),
        });
        if (error instanceof CrowdinOtaFailure) {
          throw trpcErrorFromFailure(error);
        }
        throw error;
      }

      // Best-effort cache write — a post-fetch Valkey disconnect must not
      // convert a fresh, successful upstream fetch into a 500.
      await deps.cache.trySetJSON(MANIFEST_CACHE_KEY, manifest, I18N_CACHE_TTL_MS);
      return manifest;
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
          // Format-strict schemas reject path-traversal segments before
          // they reach the Crowdin CDN URL template.
          locale: LocaleSchema,
          namespace: NamespaceSchema,
        }),
      )
      .query(async ({ input }): Promise<I18nNamespaceWithEtag> => {
        const deps = resolveDepsOrThrow(getDeps);
        const key = namespaceCacheKey(input.locale, input.namespace);

        let cached = await deps.cache.getJSON<CachedNamespace>(key);

        if (!cached) {
          try {
            const translations = await deps.ota.fetchNamespace(input.locale, input.namespace);
            const etag = computeTranslationsEtag(translations);
            cached = { etag, translations };
          } catch (error: unknown) {
            logger.warn("crowdin namespace fetch failed", {
              error: error instanceof Error ? error.message : String(error),
              locale: input.locale,
              namespace: input.namespace,
            });
            if (error instanceof CrowdinOtaFailure) {
              throw trpcErrorFromFailure(
                error,
                `Translation not found for ${input.locale}/${input.namespace}`,
              );
            }
            throw error;
          }

          // Best-effort cache write — a post-fetch Valkey disconnect must not
          // convert a fresh, successful upstream fetch into a 500.
          await deps.cache.trySetJSON(key, cached, I18N_CACHE_TTL_MS);
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
