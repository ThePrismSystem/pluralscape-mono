/**
 * Default page size for field value listing.
 *
 * Most entities have fewer than 50 field values, so a single page
 * typically covers the full list without requiring cursor pagination.
 */
export const DEFAULT_FIELD_VALUE_LIMIT = 50;

/**
 * Maximum page size for field value listing.
 *
 * Caps response payload size and query cost. Entities with more than 200
 * field values should use cursor-based pagination for incremental loading.
 */
export const MAX_FIELD_VALUE_LIMIT = 200;
