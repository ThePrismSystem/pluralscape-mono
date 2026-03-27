---
# api-nie2
title: Push notifications
status: completed
type: epic
priority: normal
created_at: 2026-03-08T12:15:47Z
updated_at: 2026-03-27T10:18:43Z
parent: ps-6itw
blocked_by:
  - api-rl9o
---

Switch alerts to friends via tier 3 metadata triggers, configurable. Stub push providers in M6; real APNs/FCM integration in M8.

### Scope (8 features)

- [x] 3.1 Type registrations for notification events
- [x] 3.2 Notification validation schemas
- [x] 3.3 Device token service
- [x] 3.4 Notification config service
- [x] 3.5 Friend notification preference service
- [x] 3.6 Notification routes
- [x] 3.7 Switch alert delivery integration
- [x] 3.8 Push notification worker

## Summary of Changes

Complete push notifications epic for M6. Implemented: typed notification-send job payload, 3 Zod validation schemas, device token service (register/revoke/list/updateLastActive), notification config service (getOrCreate/update/list), friend notification preference service (getOrCreate/update/list), 7 Hono route endpoints across 3 route groups, switch alert dispatcher with 5-condition eligibility gating and fail-closed privacy, push notification worker with stub provider. All backed by integration tests (PGlite) and E2E tests (Playwright). Real APNs/FCM providers deferred to M8.
