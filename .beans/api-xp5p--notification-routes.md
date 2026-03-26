---
# api-xp5p
title: Notification routes
status: todo
type: feature
created_at: 2026-03-26T16:04:49Z
updated_at: 2026-03-26T16:04:49Z
parent: api-nie2
blocked_by:
  - api-nlh9
---

System-level: /v1/systems/:systemId/device-tokens/ (register, list, revoke). System-level: /v1/systems/:systemId/notification-configs/ (list, update). Account-level: /v1/account/friends/:connectionId/notifications (get, update). Files: new route directories, modify routes/systems/index.ts and routes/account/friends/index.ts.
