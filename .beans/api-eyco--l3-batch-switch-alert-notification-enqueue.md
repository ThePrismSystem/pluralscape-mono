---
# api-eyco
title: "L3: Batch switch alert notification enqueue"
status: todo
type: task
priority: low
created_at: 2026-03-28T21:27:38Z
updated_at: 2026-03-28T21:27:38Z
parent: ps-tkuz
---

**Audit:** M6 audit finding L3 (Performance)
**File:** `apps/api/src/services/switch-alert-dispatcher.ts:204-225`

Each device token gets individual sequential `await queue.enqueue(...)`. Serializes N operations with many friends/devices.

**Fix:** Use bulk enqueue or `Promise.all` with concurrency limiting.
