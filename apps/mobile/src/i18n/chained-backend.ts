import { asEtag } from "@pluralscape/types";

import { logger } from "../lib/logger.js";

import type { AsyncStorageI18nCache, CacheEntry } from "./async-storage-cache.js";

export interface ChainedBackendPlugin {
  readonly type: "backend";
  read(
    language: string,
    namespace: string,
    callback: (err: Error | null, data: Readonly<Record<string, string>>) => void,
  ): void;
}

export type ChainedBackendFetch = typeof fetch;

export type ChainedBackendCache = Pick<AsyncStorageI18nCache, "read" | "write" | "isFresh">;

export interface ChainedBackendOptions {
  readonly apiBaseUrl: string;
  readonly loadBundled: (
    locale: string,
    namespace: string,
  ) => Promise<Readonly<Record<string, string>>>;
  readonly cache: ChainedBackendCache;
  readonly fetchImpl?: ChainedBackendFetch;
}

interface ApiNamespaceResponse {
  readonly data: { readonly translations: Readonly<Record<string, string>> };
}

const HTTP_OK = 200;
const HTTP_NOT_MODIFIED = 304;

function isApiNamespaceResponse(value: unknown): value is ApiNamespaceResponse {
  if (value === null || typeof value !== "object") return false;
  const record = value as { data?: unknown };
  if (record.data === null || typeof record.data !== "object") return false;
  const data = record.data as { translations?: unknown };
  if (data.translations === null || typeof data.translations !== "object") return false;
  return true;
}

function stripQuotes(value: string): string {
  return value.replace(/^"|"$/g, "");
}

export function createChainedBackend(options: ChainedBackendOptions): ChainedBackendPlugin {
  const resolvedFetch: ChainedBackendFetch = options.fetchImpl ?? globalThis.fetch;

  async function fetchNamespace(
    locale: string,
    namespace: string,
    cached: CacheEntry | null,
  ): Promise<Readonly<Record<string, string>>> {
    const headers: Record<string, string> = {};
    if (cached !== null) {
      headers["if-none-match"] = `"${cached.etag}"`;
    }
    const res = await resolvedFetch(`${options.apiBaseUrl}/v1/i18n/${locale}/${namespace}`, {
      headers,
    });
    if (res.status === HTTP_NOT_MODIFIED && cached !== null) {
      const refreshed: CacheEntry = { ...cached, fetchedAt: Date.now() };
      await options.cache.write(locale, namespace, refreshed);
      return cached.translations;
    }
    if (res.status === HTTP_OK) {
      const body: unknown = await res.json();
      if (!isApiNamespaceResponse(body)) {
        throw new Error(`Malformed i18n response for ${locale}/${namespace}`);
      }
      const etagHeader = res.headers.get("etag") ?? "";
      const entry: CacheEntry = {
        etag: asEtag(stripQuotes(etagHeader)),
        translations: body.data.translations,
        fetchedAt: Date.now(),
      };
      await options.cache.write(locale, namespace, entry);
      return body.data.translations;
    }
    throw new Error(`Unexpected status ${String(res.status)} for ${locale}/${namespace}`);
  }

  /**
   * Resolve translations for a (locale, namespace).
   *
   * Resolution order (fail-open to bundled baseline):
   *  1. Fresh OTA cache — AsyncStorage entry within TTL.
   *  2. OTA network — if fresh cache missing/stale, request our API proxy
   *     with If-None-Match; 304 refreshes fetchedAt, 200 rewrites the entry.
   *  3. Stale OTA cache — on network failure, serve the previous entry
   *     regardless of TTL.
   *  4. Bundled baseline — loadBundled() from the app package.
   */
  async function resolveNamespace(
    locale: string,
    namespace: string,
  ): Promise<Readonly<Record<string, string>>> {
    const cached = await options.cache.read(locale, namespace);
    if (cached !== null && options.cache.isFresh(cached)) {
      return cached.translations;
    }

    try {
      return await fetchNamespace(locale, namespace, cached);
    } catch (err: unknown) {
      logger.warn(`i18n OTA fetch failed, falling back: ${locale}/${namespace}`, {
        error: err instanceof Error ? err.message : String(err),
      });
      if (cached !== null) {
        return cached.translations;
      }
      return options.loadBundled(locale, namespace);
    }
  }

  return {
    type: "backend" as const,
    read(language, namespace, callback): void {
      resolveNamespace(language, namespace)
        .then((data) => {
          callback(null, data);
        })
        .catch((err: unknown) => {
          callback(err instanceof Error ? err : new Error(String(err)), {});
        });
    },
  };
}
