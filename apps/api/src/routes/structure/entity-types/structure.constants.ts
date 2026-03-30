/**
 * Default page size for structure entity type listing.
 *
 * Most systems have fewer than 25 entity types, so a single page
 * typically covers the full list.
 */
export const DEFAULT_ENTITY_TYPE_LIMIT = 25;

/**
 * Maximum page size for structure entity type listing.
 *
 * Caps response payload size and query cost.
 */
export const MAX_ENTITY_TYPE_LIMIT = 100;
