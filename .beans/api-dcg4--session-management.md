---
# api-dcg4
title: Session management
status: todo
type: task
priority: normal
created_at: 2026-03-16T11:52:33Z
updated_at: 2026-03-16T11:58:00Z
parent: api-o89k
blocked_by:
  - api-5mzr
---

GET /auth/sessions (list, cursor paginated), DELETE /auth/sessions/:id (revoke), POST /auth/logout (revoke current), POST /auth/sessions/revoke-all (revoke all except current). Idle timeout check, lastActive throttle (60s debounce). Expired session cleanup. Rate limited at authLight (20/60s).
