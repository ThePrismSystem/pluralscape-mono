---
# api-zdqb
title: Poll API routes
status: completed
type: task
priority: high
created_at: 2026-03-25T05:59:20Z
updated_at: 2026-03-25T23:50:08Z
parent: api-8lt2
blocked_by:
  - api-ho24
  - api-6m3p
---

apps/api/src/routes/polls/ — GET/POST /v1/systems/:systemId/polls, GET/PATCH/DELETE .../polls/:pollId, POST .../polls/:pollId/close, GET/POST .../polls/:pollId/votes. Tests: unit (route validation, auth checks).

## Summary of Changes\n\nCreated 11 route files in apps/api/src/routes/polls/ covering all poll and vote endpoints. Registered pollRoutes in systems/index.ts.
