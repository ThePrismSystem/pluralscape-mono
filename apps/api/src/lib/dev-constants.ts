/**
 * Dev-only constants.
 *
 * This module must NEVER be statically imported from code that ships in a
 * production bundle. Import dynamically inside a `process.env.NODE_ENV !==
 * "production"` branch (or equivalent) so dead-code elimination drops both
 * the branch and the string literals in prod builds.
 *
 * Production boot is separately guarded by Zod refines in env.ts; this module
 * is defense-in-depth on top of those.
 */

/** Default anti-enumeration salt secret used only in dev/test. */
export const ANTI_ENUM_SALT_SECRET_DEFAULT = "pluralscape-dev-anti-enum-secret-do-not-use-in-prod";

/** Hex length of HMAC key (32 bytes = 64 hex characters). */
const HMAC_KEY_HEX_LENGTH = 64;

/** Default HMAC key used only in dev/test when API_KEY_HMAC_KEY is unset. */
export const DEV_HMAC_KEY = "0".repeat(HMAC_KEY_HEX_LENGTH);
