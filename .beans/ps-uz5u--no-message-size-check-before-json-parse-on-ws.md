---
# ps-uz5u
title: No message size check before JSON parse on WS
status: completed
type: task
priority: normal
created_at: 2026-03-21T02:57:09Z
updated_at: 2026-03-21T08:00:21Z
parent: ps-i3xl
---

Add string length check before JSON.parse, ws/index.ts:146

## Summary of Changes\n\nAdded message length check against WS_MAX_MESSAGE_BYTES before JSON.parse in the WS onMessage handler to reject oversized payloads early.
