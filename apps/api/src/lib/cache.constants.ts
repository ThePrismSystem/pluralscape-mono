/**
 * Cache TTL constants for query result caching.
 * Domain: service-layer in-memory caching.
 */

import type { SystemId } from "@pluralscape/types";

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

/**
 * Per-domain cache key prefixes so different services can share a single
 * in-memory cache without colliding on opaque keys. Values double as the
 * second colon-separated segment of every generated key.
 */
export const CACHE_DOMAINS = {
  switchAlert: "switch-alert",
  fieldDefinition: "field-definition",
} as const;

export type CacheDomain = (typeof CACHE_DOMAINS)[keyof typeof CACHE_DOMAINS];

/**
 * Build a canonical cache key of the form `systemId:domain:partA:partB...`.
 * Centralises the shape so services don't invent incompatible variants.
 */
export function buildCacheKey(
  systemId: SystemId,
  domain: CacheDomain,
  ...parts: readonly string[]
): string {
  return [systemId, domain, ...parts].join(":");
}
