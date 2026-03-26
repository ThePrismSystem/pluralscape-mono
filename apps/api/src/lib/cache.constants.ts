/**
 * Cache TTL constants for query result caching.
 * Domain: service-layer in-memory caching.
 */

/** Cache TTL for system settings reads (60 seconds). */
export const SYSTEM_SETTINGS_CACHE_TTL_MS = 60_000;

/** Cache TTL for field definition list reads (300 seconds / 5 minutes). */
export const FIELD_DEFINITIONS_CACHE_TTL_MS = 300_000;

/** Cache TTL for webhook config reads per system (60 seconds). */
export const WEBHOOK_CONFIGS_CACHE_TTL_MS = 60_000;
