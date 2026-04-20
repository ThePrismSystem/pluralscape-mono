---
# api-uo21
title: Cache notificationConfigs in switch-alert-dispatcher
status: completed
type: task
priority: high
created_at: 2026-04-20T09:21:35Z
updated_at: 2026-04-20T12:42:50Z
parent: api-v8zu
---

Finding [P5] from audit 2026-04-20. apps/api/src/services/switch-alert-dispatcher.ts:53-65. Fire-and-forget on every fronting session create with no caching (unlike webhook configs which use QueryCache). Most frequent path. Add in-request or short-TTL cache.

## Summary of Changes

Cached the per-(systemId, eventType) notificationConfigs read in switch-alert-dispatcher behind the existing QueryCache primitive (60s TTL, NOTIFICATION_CONFIGS_CACHE_TTL_MS). Explicit invalidation (invalidateSwitchAlertConfigCache) is wired into notification-config.service's update path so operator toggles take effect within a single dispatch. Added integration tests: one proving cache-hit avoids the DB read after row deletion within TTL, one proving fail-closed behaviour once the cache is cleared.
