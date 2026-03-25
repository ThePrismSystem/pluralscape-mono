---
# api-qno1
title: Message API routes
status: completed
type: task
priority: high
created_at: 2026-03-25T05:59:18Z
updated_at: 2026-03-25T07:22:58Z
parent: api-ryy0
blocked_by:
  - api-258a
  - api-1hv8
---

apps/api/src/routes/messages/ — GET/POST /v1/systems/:systemId/channels/:channelId/messages, GET/PATCH/DELETE .../messages/:messageId. Tests: unit (route validation, auth checks, error responses).

## Summary of Changes\n\nCreated 8 message route files nested under channels at /:channelId/messages with optional timestamp query param on single-entity endpoints.
