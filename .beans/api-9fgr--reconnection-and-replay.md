---
# api-9fgr
title: Reconnection and replay
status: completed
type: task
priority: normal
created_at: 2026-03-19T11:39:41Z
updated_at: 2026-03-20T10:36:33Z
parent: api-n8wk
---

Emit \`id:\` per SSE event. On reconnect with Last-Event-ID header, replay missed notifications within bounded window.

## Acceptance Criteria

- Each SSE event has a unique, monotonic \`id:\` field
- Client reconnect with Last-Event-ID → missed events replayed in order
- Replay window bounded (e.g., last 100 events or 5 minutes)
- Events older than replay window not replayed (client must handle gap)
- Integration test: disconnect, accumulate events, reconnect with Last-Event-ID, verify replay

## Summary of Changes

- Created SseEventBuffer class with monotonic ID generation
- Ring buffer eviction at SSE_REPLAY_BUFFER_SIZE (100) events
- Replay via Last-Event-ID header with gap detection (returns full-sync event)
- Events older than SSE_REPLAY_MAX_AGE_MS filtered from replay
