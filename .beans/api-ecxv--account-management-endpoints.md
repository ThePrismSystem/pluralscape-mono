---
# api-ecxv
title: Account management endpoints
status: todo
type: task
created_at: 2026-03-16T11:33:04Z
updated_at: 2026-03-16T11:33:04Z
priority: normal
parent: api-o89k
blocked_by:
  - api-1v5r
---

GET /account (current account info), PUT /account/email (change email, re-hash), PUT /account/password (change password, re-derive KEK, re-wrap master key, invalidate other sessions). Session management endpoints (list, revoke, revoke-all) live in api-dcg4.
