---
# ps-rmth
title: "SSE stream: wrap module-level state in class or factory"
status: completed
type: task
priority: normal
created_at: 2026-03-21T02:57:09Z
updated_at: 2026-03-21T08:08:32Z
parent: ps-i3xl
---

routes/notifications/stream.ts:41-42

## Summary of Changes

Extracted accountStates Map and noPubSubWarningLogged into an SseStateManager class with getOrCreate(), get(), delete(), reset(), and warningLogged accessors. Updated route handler and test helpers to delegate to the class.
