export {
  DEFAULT_LOCALE,
  DEFAULT_NAMESPACE,
  NAMESPACES,
  RTL_LOCALES,
  SUPPORTED_LOCALES,
} from "./i18n.constants.js";
export { createI18nInstance } from "./create-i18n.js";
export type { CreateI18nOptions } from "./create-i18n.js";
export { formatDate, formatDateTime, formatTime } from "./format-date.js";
export { formatDuration, formatFrontingDuration } from "./format-duration.js";
export { formatCompactNumber, formatNumber, formatPercentage } from "./format-number.js";
export { formatRelativeTime } from "./format-relative-time.js";
export { createMissingKeyHandler } from "./missing-key-handler.js";
export {
  CANONICAL_TERMS,
  PRESET_PLURAL_RULES,
  resolveTerm,
  resolveTermLower,
  resolveTermPlural,
  resolveTermTitle,
  resolveTermUpper,
} from "./nomenclature.js";
export type { UseNomenclatureResult } from "./nomenclature.js";
export { getTextDirection, isRtl } from "./text-direction.js";
export type { I18nConfig, I18nNamespace, TranslationResources } from "./types.js";
