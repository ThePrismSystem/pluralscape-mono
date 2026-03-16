---
# api-qzdt
title: Recovery key backup and regeneration
status: todo
type: task
priority: normal
created_at: 2026-03-16T11:52:38Z
updated_at: 2026-03-16T11:58:01Z
parent: api-o89k
blocked_by:
  - api-1v5r
  - api-e0c2
---

POST /auth/recovery-key/regenerate (revoke old, generate new encrypted master key backup, audit log). GET /auth/recovery-key/status (has active key, not the key itself).
