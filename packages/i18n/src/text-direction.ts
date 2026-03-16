import { RTL_LOCALES } from "./constants.js";

import type { Locale, TextDirection } from "@pluralscape/types";

/** Returns whether the given locale uses right-to-left text. */
export function isRtl(locale: Locale): boolean {
  const prefix = locale.split("-")[0]?.toLowerCase() ?? "";
  return (RTL_LOCALES as readonly string[]).includes(prefix);
}

/** Returns the text direction for the given locale. */
export function getTextDirection(locale: Locale): TextDirection {
  return isRtl(locale) ? "rtl" : "ltr";
}
