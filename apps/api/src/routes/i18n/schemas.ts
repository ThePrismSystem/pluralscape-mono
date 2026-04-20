import { z } from "zod/v4";

/**
 * Validation schemas for Crowdin OTA CDN URL segments.
 *
 * `locale` and `namespace` are interpolated directly into an HTTPS URL
 * against the Crowdin distribution CDN. Without validation a crafted
 * input like `../../evil` or a percent-encoded `%2F..%2Fetc%2Fpasswd`
 * would let a client coax the server into fetching an arbitrary
 * upstream path and returning the body to the caller. The regexes
 * below enforce the exact character set permitted by the Crowdin URL
 * scheme (BCP-47-ish locales and filesystem-safe namespace names).
 *
 * Keep the schemas colocated with the i18n routes so both the Hono
 * handler and the tRPC procedure consume the same source of truth.
 */

/**
 * BCP-47-ish locale pattern: a 2-3 letter primary language optionally
 * followed by a hyphen and a 2-4 char region/script subtag.
 *
 * Examples accepted: `en`, `en-US`, `zh-Hant`.
 * Examples rejected: `en_US`, `../etc`, `en-%2E%2E`, empty string.
 */
const LOCALE_PATTERN = /^[a-zA-Z]{2,3}(-[a-zA-Z]{2,4})?$/;

/**
 * Namespace pattern: letters, digits, underscore, and hyphen only.
 * Dots are explicitly disallowed to block path-traversal segments.
 */
const NAMESPACE_PATTERN = /^[a-zA-Z0-9_-]+$/;

/** Zod schema enforcing a safe locale identifier. */
export const LocaleSchema = z.string().regex(LOCALE_PATTERN, { message: "Invalid locale format" });

/** Zod schema enforcing a safe namespace identifier. */
export const NamespaceSchema = z
  .string()
  .regex(NAMESPACE_PATTERN, { message: "Invalid namespace format" });

/**
 * Throws if `locale` or `namespace` fails validation.
 *
 * Acts as a belt-and-braces check inside the OTA service so a future
 * caller that bypasses route-level validation (e.g., a background
 * job) still can't push an unsafe segment into the CDN URL.
 */
export function assertSafeLocaleAndNamespace(locale: string, namespace: string): void {
  LocaleSchema.parse(locale);
  NamespaceSchema.parse(namespace);
}
