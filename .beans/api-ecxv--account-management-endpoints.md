---
# api-ecxv
title: Account management endpoints
status: todo
type: task
created_at: 2026-03-16T11:33:04Z
updated_at: 2026-03-16T11:33:04Z
parent: ps-rdqo
blocked_by:
  - api-o89k
---

GET /account (current account info), PUT /account/email (change email, re-hash), PUT /account/password (change password, re-derive KEK, re-wrap master key, invalidate other sessions), GET /account/sessions (list active sessions with encrypted device info), DELETE /account/sessions/:id (revoke session), POST /account/sessions/revoke-all (revoke all except current).
