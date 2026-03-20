/**
 * Innerworld entity pagination constants.
 * Domain: innerworld entity list endpoints.
 */

/**
 * Default page size for entity list queries.
 *
 * Higher than other endpoints (50 vs 25) because inner world entities
 * are lightweight (small encrypted payloads) and commonly rendered
 * together on a spatial map where partial loads create visual gaps.
 */
export const DEFAULT_ENTITY_LIMIT = 50;

/**
 * Maximum page size for entity list queries.
 *
 * Higher cap (200 vs 100) to support loading all entities for a region
 * in a single request. Map-based UIs benefit from having the full
 * dataset available without pagination artifacts.
 */
export const MAX_ENTITY_LIMIT = 200;
