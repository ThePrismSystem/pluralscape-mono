---
# api-ghja
title: Group membership management
status: completed
type: task
priority: normal
created_at: 2026-03-16T11:56:49Z
updated_at: 2026-03-17T21:40:23Z
parent: api-tzme
blocked_by:
  - api-2ev2
  - api-b0nb
---

POST .../groups/:groupId/members (add). DELETE remove. GET list members in group. Multi-membership: member belongs to multiple groups. PK (groupId, memberId).

## Summary of Changes\n\nGroup membership: add/remove/list with PK duplicate handling and member/group existence validation.
