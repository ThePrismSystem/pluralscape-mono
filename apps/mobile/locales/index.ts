/**
 * Bundled locale loader.
 *
 * Uses dynamic `import()` so Metro code-splits each locale's namespace JSON
 * into a separate chunk. Only the active locale's chunks are parsed at runtime.
 *
 * OTA translations layered on top via the chained backend take precedence when
 * fresh. This loader is the offline-first baseline.
 */

export const BUNDLED_LOCALES = [
  "en",
  "es",
  "es-419",
  "fr",
  "de",
  "it",
  "pt-BR",
  "ru",
  "nl",
  "zh-Hans",
  "ja",
  "ko",
  "ar",
] as const;

export const BUNDLED_NAMESPACES = ["common", "auth", "fronting", "members", "settings"] as const;

import { logger } from "../src/lib/logger.js";

type BundledLocale = (typeof BUNDLED_LOCALES)[number];
type BundledNamespace = (typeof BUNDLED_NAMESPACES)[number];
type NamespaceData = Readonly<Record<string, string>>;
type NamespaceLoader = () => Promise<{ readonly default: NamespaceData }>;

/**
 * One literal import per file, because Metro rejects computed import paths. It
 * still code-splits each file into its own chunk.
 */
const NAMESPACE_LOADERS: Readonly<
  Record<BundledLocale, Readonly<Record<BundledNamespace, NamespaceLoader>>>
> = {
  en: {
    common: () => import("./en/common.json"),
    auth: () => import("./en/auth.json"),
    fronting: () => import("./en/fronting.json"),
    members: () => import("./en/members.json"),
    settings: () => import("./en/settings.json"),
  },
  es: {
    common: () => import("./es/common.json"),
    auth: () => import("./es/auth.json"),
    fronting: () => import("./es/fronting.json"),
    members: () => import("./es/members.json"),
    settings: () => import("./es/settings.json"),
  },
  "es-419": {
    common: () => import("./es-419/common.json"),
    auth: () => import("./es-419/auth.json"),
    fronting: () => import("./es-419/fronting.json"),
    members: () => import("./es-419/members.json"),
    settings: () => import("./es-419/settings.json"),
  },
  fr: {
    common: () => import("./fr/common.json"),
    auth: () => import("./fr/auth.json"),
    fronting: () => import("./fr/fronting.json"),
    members: () => import("./fr/members.json"),
    settings: () => import("./fr/settings.json"),
  },
  de: {
    common: () => import("./de/common.json"),
    auth: () => import("./de/auth.json"),
    fronting: () => import("./de/fronting.json"),
    members: () => import("./de/members.json"),
    settings: () => import("./de/settings.json"),
  },
  it: {
    common: () => import("./it/common.json"),
    auth: () => import("./it/auth.json"),
    fronting: () => import("./it/fronting.json"),
    members: () => import("./it/members.json"),
    settings: () => import("./it/settings.json"),
  },
  "pt-BR": {
    common: () => import("./pt-BR/common.json"),
    auth: () => import("./pt-BR/auth.json"),
    fronting: () => import("./pt-BR/fronting.json"),
    members: () => import("./pt-BR/members.json"),
    settings: () => import("./pt-BR/settings.json"),
  },
  ru: {
    common: () => import("./ru/common.json"),
    auth: () => import("./ru/auth.json"),
    fronting: () => import("./ru/fronting.json"),
    members: () => import("./ru/members.json"),
    settings: () => import("./ru/settings.json"),
  },
  nl: {
    common: () => import("./nl/common.json"),
    auth: () => import("./nl/auth.json"),
    fronting: () => import("./nl/fronting.json"),
    members: () => import("./nl/members.json"),
    settings: () => import("./nl/settings.json"),
  },
  "zh-Hans": {
    common: () => import("./zh-Hans/common.json"),
    auth: () => import("./zh-Hans/auth.json"),
    fronting: () => import("./zh-Hans/fronting.json"),
    members: () => import("./zh-Hans/members.json"),
    settings: () => import("./zh-Hans/settings.json"),
  },
  ja: {
    common: () => import("./ja/common.json"),
    auth: () => import("./ja/auth.json"),
    fronting: () => import("./ja/fronting.json"),
    members: () => import("./ja/members.json"),
    settings: () => import("./ja/settings.json"),
  },
  ko: {
    common: () => import("./ko/common.json"),
    auth: () => import("./ko/auth.json"),
    fronting: () => import("./ko/fronting.json"),
    members: () => import("./ko/members.json"),
    settings: () => import("./ko/settings.json"),
  },
  ar: {
    common: () => import("./ar/common.json"),
    auth: () => import("./ar/auth.json"),
    fronting: () => import("./ar/fronting.json"),
    members: () => import("./ar/members.json"),
    settings: () => import("./ar/settings.json"),
  },
};

function isBundledLocale(locale: string): locale is BundledLocale {
  return BUNDLED_LOCALES.some((bundled) => bundled === locale);
}

function isBundledNamespace(namespace: string): namespace is BundledNamespace {
  return BUNDLED_NAMESPACES.some((bundled) => bundled === namespace);
}

/**
 * Graceful failure: returns an empty object if the locale or namespace is not
 * bundled or its file fails to load. The chained backend tolerates empty bundled
 * data and falls through to OTA or i18next's missing-key handler.
 */
export async function loadBundledNamespace(
  locale: string,
  namespace: string,
): Promise<NamespaceData> {
  try {
    if (!isBundledLocale(locale) || !isBundledNamespace(namespace)) {
      throw new Error("not bundled");
    }
    const mod = await NAMESPACE_LOADERS[locale][namespace]();
    return mod.default;
  } catch (err: unknown) {
    logger.warn(`bundled namespace load failed: ${locale}/${namespace}`, {
      error: err instanceof Error ? err.message : String(err),
    });
    return {};
  }
}
