---
# api-au62
title: Notification E2E tests and OpenAPI
status: todo
type: feature
created_at: 2026-03-26T17:09:12Z
updated_at: 2026-03-26T17:09:12Z
parent: api-nie2
blocked_by:
  - api-xp5p
---

E2E tests for notification endpoints. Test scenarios: register device token (valid platforms), list device tokens, revoke device token, get/update notification config (per-event-type toggles), get/update friend notification preferences (requires accepted connection), verify revoked tokens excluded from list, verify default config creation on first access, non-existent connection returns 404. OpenAPI spec additions for all notification endpoints. Files: apps/api-e2e/src/tests/notifications/device-tokens.spec.ts (new), apps/api-e2e/src/tests/notifications/config.spec.ts (new), apps/api-e2e/src/tests/notifications/friend-preferences.spec.ts (new).
