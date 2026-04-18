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

/**
 * Dynamic import so Metro code-splits each locale's JSON into a separate chunk.
 * The template literal path `./${locale}/${namespace}.json` is Metro-compatible
 * when the static prefix (`./`) and suffix (`.json`) are literal. If Metro
 * rejects this pattern at bundle time, fall back to a static per-locale switch.
 *
 * Graceful failure: returns an empty object if the locale or namespace file
 * does not exist. The chained backend tolerates empty bundled data and falls
 * through to OTA or i18next's missing-key handler.
 *
 * The `as { default: ... }` cast below is a narrowing at the JSON-import trust
 * boundary: TypeScript cannot know the shape of arbitrary JSON files. Per-file
 * schema validation is heavier than the guarantee warrants.
 */
export async function loadBundledNamespace(
  locale: string,
  namespace: string,
): Promise<Readonly<Record<string, string>>> {
  try {
    const mod = (await import(`./${locale}/${namespace}.json`)) as {
      default: Readonly<Record<string, string>>;
    };
    return mod.default;
  } catch (err: unknown) {
    globalThis.console.warn(`bundled namespace load failed: ${locale}/${namespace}`, err);
    return {};
  }
}
