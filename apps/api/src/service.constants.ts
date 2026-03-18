/**
 * Shared service-layer constants.
 * Domain: all entity CRUD services.
 */

/** Maximum size of encrypted data in bytes after base64 decode (64 KiB). */
export const MAX_ENCRYPTED_DATA_BYTES = 65_536;

/** Maximum size of encrypted system data in bytes after base64 decode (98 KiB). */
export const MAX_ENCRYPTED_SYSTEM_DATA_BYTES = 98_304;

/** Default page size for list endpoints. */
export const DEFAULT_PAGE_LIMIT = 25;

/** Maximum page size for list endpoints. */
export const MAX_PAGE_LIMIT = 100;
