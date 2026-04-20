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

/**
 * Cache TTL for notificationConfigs reads per (systemId, eventType).
 *
 * switch-alert-dispatcher hot-reads one notification config row per
 * outgoing fronting event; caching for 60s matches the webhook-dispatcher
 * pattern and absorbs the typical bursty read load without letting stale
 * settings linger after operator toggles.
 */
export const NOTIFICATION_CONFIGS_CACHE_TTL_MS = 60_000;
