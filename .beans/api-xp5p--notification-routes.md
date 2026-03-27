---
# api-xp5p
title: Notification routes
status: completed
type: feature
priority: normal
created_at: 2026-03-26T16:04:49Z
updated_at: 2026-03-27T07:37:51Z
parent: api-nie2
blocked_by:
  - api-nlh9
  - api-a86z
  - api-zcu8
---

System-level: /v1/systems/:systemId/device-tokens/ (register, list, revoke). System-level: /v1/systems/:systemId/notification-configs/ (list, update). Account-level: /v1/account/friends/:connectionId/notifications (get, update). Files: new route directories, modify routes/systems/index.ts and routes/account/friends/index.ts.

## Summary of Changes

Created three route groups: device-tokens (POST register, GET list, POST revoke), notification-configs (GET list, PATCH update), and friend notifications (GET preference, PATCH update). Wired into systems/index.ts and account/friends/index.ts.
