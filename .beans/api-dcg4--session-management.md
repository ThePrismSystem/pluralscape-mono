---
# api-dcg4
title: Session management
status: completed
type: task
priority: normal
created_at: 2026-03-16T11:52:33Z
updated_at: 2026-03-17T00:02:46Z
parent: api-o89k
blocked_by:
  - api-5mzr
---

GET /auth/sessions (list, cursor paginated), DELETE /auth/sessions/:id (revoke), POST /auth/logout (revoke current), POST /auth/sessions/revoke-all (revoke all except current). Idle timeout check, lastActive throttle (60s debounce). Expired session cleanup. Rate limited at authLight (20/60s).

## Todo

- [x] Create lib/session-auth.ts (validateSession)
- [x] Add session management functions to auth.service.ts (listSessions, revokeSession, revokeAllSessions, logoutCurrentSession)
- [x] Create sessions.ts route handler
- [x] Add session routes to auth/index.ts
- [x] Write session management tests
- [x] Write session-auth tests

## Summary of Changes

Session management endpoints: GET /auth/sessions (cursor paginated), DELETE /auth/sessions/:id, POST /auth/logout, POST /auth/sessions/revoke-all. Session validation utility (validateSession) with absolute/idle TTL checks.
