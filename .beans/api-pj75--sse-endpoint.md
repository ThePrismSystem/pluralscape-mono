---
# api-pj75
title: SSE endpoint
status: todo
type: task
priority: normal
created_at: 2026-03-19T11:39:41Z
updated_at: 2026-03-19T11:39:41Z
parent: api-n8wk
---

Implement \`GET /v1/notifications/stream\` with \`Content-Type: text/event-stream\`. Session auth required.

## Acceptance Criteria

- Authenticated request → SSE stream opened with correct headers (Content-Type: text/event-stream, Cache-Control: no-cache, Connection: keep-alive)
- Unauthenticated request → 401 response (no stream)
- Expired session → 401 response
- Stream remains open until client disconnects or server closes
- Unit tests for auth validation and header correctness
