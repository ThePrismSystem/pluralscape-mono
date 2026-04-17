import type { Locale } from "@pluralscape/types";

/** The default locale used when no locale is detected or configured. */
export const DEFAULT_LOCALE = "en" as Locale;

/** All locales the application supports. */
export const SUPPORTED_LOCALES: readonly Locale[] = [
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
] as Locale[];

/** Translation namespace names — one per feature area. */
export const NAMESPACES = [
  "common",
  "auth",
  "members",
  "fronting",
  "settings",
  "communication",
  "groups",
  "privacy",
  "structure",
] as const;

/** The default namespace used when none is specified. */
export const DEFAULT_NAMESPACE = "common" as const;

/** Locales that use right-to-left text direction. */
export const RTL_LOCALES = ["ar", "he", "fa", "ur"] as const;
