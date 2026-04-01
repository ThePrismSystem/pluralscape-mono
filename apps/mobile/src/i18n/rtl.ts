import { isRtl } from "@pluralscape/i18n";
import { I18nManager } from "react-native";

import type { Locale } from "@pluralscape/types";

export function applyLayoutDirection(locale: string): void {
  const rtl = isRtl(locale as Locale);
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(rtl);
}
