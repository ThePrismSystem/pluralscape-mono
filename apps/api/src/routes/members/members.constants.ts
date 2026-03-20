/**
 * Default page size for member listing.
 *
 * Most plural systems have fewer than 25 members, so a single page
 * typically covers the full list without requiring cursor pagination.
 */
export const DEFAULT_MEMBER_LIMIT = 25;

/**
 * Maximum page size for member listing.
 *
 * Caps response payload size and query cost. Systems with more than 100
 * members should use cursor-based pagination for incremental loading.
 */
export const MAX_MEMBER_LIMIT = 100;

/** Maximum byte length for decoded encrypted member data. */
export const MAX_ENCRYPTED_MEMBER_DATA_BYTES = 131_072;
