---
# api-a86z
title: Notification config service
status: completed
type: feature
priority: normal
created_at: 2026-03-26T16:04:32Z
updated_at: 2026-03-27T07:28:06Z
parent: api-nie2
---

Implement getOrCreateNotificationConfig, updateNotificationConfig, listNotificationConfigs. Per-event-type toggles (enabled, pushEnabled). Files: apps/api/src/services/notification-config.service.ts (new). Tests: unit + integration; default creation, update, list.

## Summary of Changes

Implemented notification-config.service.ts with getOrCreateNotificationConfig (defaults enabled+pushEnabled to true), updateNotificationConfig (partial boolean updates with audit), and listNotificationConfigs (non-archived for system). Integration tests with PGlite.
