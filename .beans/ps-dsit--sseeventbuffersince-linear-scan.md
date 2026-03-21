---
# ps-dsit
title: SseEventBuffer.since() linear scan
status: completed
type: task
priority: normal
created_at: 2026-03-21T02:57:09Z
updated_at: 2026-03-21T08:00:21Z
parent: ps-i3xl
---

Acceptable (capped at 100), document rationale, sse-manager.ts:100-118

## Summary of Changes\n\nAdded JSDoc to since() method documenting that linear scan is acceptable because the buffer is capped at SSE_REPLAY_BUFFER_SIZE (100 entries).
