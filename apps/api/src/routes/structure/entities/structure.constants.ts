/**
 * Default page size for structure entity listing.
 *
 * Most systems have fewer than 25 entities per type, so a single page
 * typically covers the full list.
 */
export const DEFAULT_ENTITY_LIMIT = 25;

/**
 * Maximum page size for structure entity listing.
 *
 * Caps response payload size and query cost.
 */
export const MAX_ENTITY_LIMIT = 100;
