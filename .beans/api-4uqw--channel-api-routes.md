---
# api-4uqw
title: Channel API routes
status: completed
type: task
priority: high
created_at: 2026-03-25T05:59:18Z
updated_at: 2026-03-25T07:22:57Z
parent: api-ryy0
blocked_by:
  - api-258a
  - api-cqkh
---

apps/api/src/routes/channels/ — GET/POST /v1/systems/:systemId/channels, GET/PATCH/DELETE .../channels/:channelId, POST .../archive, POST .../restore. Tests: unit (route validation, auth checks, error responses).

## Summary of Changes\n\nCreated 8 channel route files (CRUD + archive/restore) mounted at /v1/systems/:systemId/channels.
