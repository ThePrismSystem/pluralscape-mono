---
# api-au62
title: Notification E2E tests and OpenAPI
status: completed
type: feature
priority: normal
created_at: 2026-03-26T17:09:12Z
updated_at: 2026-03-27T10:18:19Z
parent: api-nie2
blocked_by:
  - api-xp5p
---

E2E tests for notification endpoints. Test scenarios: register device token (valid platforms), list device tokens, revoke device token, get/update notification config (per-event-type toggles), get/update friend notification preferences (requires accepted connection), verify revoked tokens excluded from list, verify default config creation on first access, non-existent connection returns 404. OpenAPI spec additions for all notification endpoints. Files: apps/api-e2e/src/tests/notifications/device-tokens.spec.ts (new), apps/api-e2e/src/tests/notifications/config.spec.ts (new), apps/api-e2e/src/tests/notifications/friend-preferences.spec.ts (new).

## Summary of Changes

Created three E2E spec files covering all notification endpoints: device-tokens.spec.ts (register/list/revoke lifecycle, validation errors), notification-configs.spec.ts (list/update lifecycle, invalid event type/empty body), friend-notification-preferences.spec.ts (get defaults/update/restore via friend connection fixture, 404 for non-existent). Regenerated PG migrations from scratch to include the 4 new audit event types. All 167 E2E tests pass.
