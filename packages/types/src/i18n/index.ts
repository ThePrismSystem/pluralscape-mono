export { I18N_CACHE_TTL_MS, I18N_OTA_TIMEOUT_MS, I18N_ETAG_LENGTH } from "./constants.js";

export interface I18nNamespaceManifest {
  readonly name: string;
  readonly etag: string;
}

export interface I18nLocaleManifest {
  readonly locale: string;
  readonly namespaces: readonly I18nNamespaceManifest[];
}

export interface I18nManifest {
  readonly distributionTimestamp: number;
  readonly locales: readonly I18nLocaleManifest[];
}

export interface I18nNamespace {
  readonly translations: Readonly<Record<string, string>>;
}
