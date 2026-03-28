---
# api-eyco
title: "L3: Batch switch alert notification enqueue"
status: completed
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

## Summary of Changes

Replaced the sequential per-token `await queue.enqueue(...)` loop with batched `Promise.allSettled` using `ENQUEUE_CONCURRENCY = 10`. Tokens are processed in batches of 10 concurrently, matching the existing bounded-concurrency pattern used in WebSocket handlers. Failed enqueue operations within a batch are logged individually without blocking siblings.
