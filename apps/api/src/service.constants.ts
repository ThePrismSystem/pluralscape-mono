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

/**
 * Maximum nesting depth for hierarchical structures (groups, subsystems).
 *
 * The ancestor walk uses this as both a cycle-detection guard and a hard depth
 * cap. Any attempt to create a parent chain deeper than 50 levels returns
 * 409 Conflict. The limit prevents pathological recursive queries while
 * exceeding any realistic organizational depth.
 *
 * See also: `docs/api-limits.md`
 */
export const MAX_ANCESTOR_DEPTH = 50;
