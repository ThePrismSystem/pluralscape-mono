import type { Locale } from "@pluralscape/types";

/**
 * Re-export `SUPPORTED_LOCALES` from `@pluralscape/types`. The canonical
 * declaration lives with the `Locale` type (one source of truth) so a new
 * locale cannot be added to the runtime tuple without simultaneously
 * widening the compile-time union.
 */
export { SUPPORTED_LOCALES } from "@pluralscape/types";

/** The default locale used when no locale is detected or configured. */
export const DEFAULT_LOCALE: Locale = "en";

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

/**
 * Locales that use right-to-left text direction.
 *
 * Broader than `SUPPORTED_LOCALES` by design — `isRtl` accepts any BCP 47
 * prefix (including `he`, `fa`, `ur` which we do not ship translations for
 * but may receive as device-detected fallbacks).
 */
export const RTL_LOCALES = ["ar", "he", "fa", "ur"] as const;
