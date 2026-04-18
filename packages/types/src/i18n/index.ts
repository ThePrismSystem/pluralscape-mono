export { I18N_CACHE_TTL_MS, I18N_OTA_TIMEOUT_MS, I18N_ETAG_LENGTH } from "./constants.js";

declare const EtagBrand: unique symbol;

/**
 * A strong validator string (RFC 7232 §2.3). Constructed only via `asEtag`
 * so raw strings cannot flow into places that expect a validator — the
 * branded nominal type forces an explicit narrowing step at the boundary
 * where the string is produced (hash, HTTP header parse, cache read).
 */
export type Etag = string & { readonly [EtagBrand]: "Etag" };

/**
 * Narrow a raw string into an `Etag`. This is the single place a raw string
 * becomes an `Etag` — all downstream consumers receive the branded type and
 * cannot accidentally synthesize one. Accepts unquoted content; the quoted
 * form (`"..."`) is an HTTP-wire concern handled separately at the transport
 * boundary (`ETag`/`If-None-Match` header serialization).
 */
export function asEtag(raw: string): Etag {
  return raw as Etag;
}

export interface I18nNamespaceManifest {
  readonly name: string;
  readonly etag: Etag;
}

export interface I18nLocaleManifest {
  readonly locale: string;
  readonly namespaces: readonly I18nNamespaceManifest[];
}

export interface I18nManifest {
  readonly distributionTimestamp: number;
  /**
   * Locales advertised by the upstream distribution. Typed as a non-empty
   * tuple — "a manifest with zero locales" is an upstream contract failure,
   * surfaced as `CrowdinOtaFailure({ kind: "malformed" })` before reaching
   * this shape.
   */
  readonly locales: readonly [I18nLocaleManifest, ...I18nLocaleManifest[]];
}

export interface I18nNamespace {
  readonly translations: Readonly<Record<string, string>>;
}

/**
 * Extension of `I18nNamespace` that carries the server-computed `Etag` in
 * the body. Used by the tRPC `i18n.getNamespace` response where the ETag
 * cannot be piggybacked on an HTTP header (tRPC replies are JSON envelopes
 * over a shared batch transport).
 */
export interface I18nNamespaceWithEtag extends I18nNamespace {
  readonly etag: Etag;
}
