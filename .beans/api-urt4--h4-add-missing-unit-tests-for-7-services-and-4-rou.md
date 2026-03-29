---
# api-urt4
title: "H4: Add missing unit tests for 7 services and 4 route groups"
status: completed
type: task
priority: high
created_at: 2026-03-28T21:26:32Z
updated_at: 2026-03-29T00:05:19Z
parent: ps-tkuz
---

**Audit:** M6 audit finding H4 (Tests)

Services without unit tests:

- [ ] `bucket.service.ts`
- [ ] `bucket-content-tag.service.ts`
- [ ] `bucket-export.service.ts`
- [ ] `device-token.service.ts`
- [ ] `notification-config.service.ts`
- [ ] `push-notification-worker.ts`
- [ ] `friend-export.service.ts`

Route groups without unit tests:

- [ ] `routes/account/friends/export.ts`
- [ ] `routes/device-tokens/` (register, list, revoke)
- [ ] `routes/notification-configs/` (list, update)
- [ ] `routes/account/friends/notifications/` (get, update)

Integration and E2E coverage exist — unit tests needed for edge cases and error paths in isolation.
