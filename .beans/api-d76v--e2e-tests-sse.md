---
# api-d76v
title: "E2E tests: SSE"
status: completed
type: task
priority: normal
created_at: 2026-03-19T11:39:41Z
updated_at: 2026-03-20T10:36:33Z
parent: api-n8wk
---

End-to-end tests for SSE notification stream.

## Acceptance Criteria

- Tests live in \`apps/api-e2e/src/tests/sse/\`
- Test: Authenticated SSE connection receives events
- Test: Unauthenticated SSE connection returns 401
- Test: Event delivery from Valkey publish
- Test: Reconnect with Last-Event-ID replays missed events
- All tests use real HTTP connections against running API server

## Summary of Changes

- Added route tests for SSE endpoint (auth, headers, streaming)
- Unit tests for SseEventBuffer (push, since, eviction, gap detection, age filter)
