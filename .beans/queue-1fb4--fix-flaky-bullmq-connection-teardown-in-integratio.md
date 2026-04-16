---
# queue-1fb4
title: Fix flaky BullMQ connection teardown in integration tests
status: completed
type: bug
priority: normal
created_at: 2026-03-27T21:11:56Z
updated_at: 2026-04-16T07:29:49Z
parent: ps-6itw
---

Persistent 'Connection is closed' unhandled rejections from ioredis during test teardown. Root cause: fetchWorker (BullMQ Worker with autorun:false) is eagerly created in BullMQJobQueue constructor, starting ioredis connections that may never be used. When close() is called before connections settle, pending commands are rejected. Fix: lazy fetchWorker, error event listeners, and test teardown hardening.

## Summary of Changes

Root cause: BullMQJobQueue eagerly created a fetchWorker (BullMQ Worker with autorun:false) in the constructor, opening 2 ioredis connections (main + blocking) that may never be used. When close() was called before these connections finished initializing, BullMQ used ioredis.disconnect() instead of quit(), rejecting pending init commands as unhandled promise rejections. This was timing-dependent (flaky).

### Fix (3 layers of defense):

1. **Lazy fetchWorker creation** (`bullmq-job-queue.ts`): The fetchWorker is now created on first `dequeue()` call via `ensureFetchWorker()`, not in the constructor. Tests that never dequeue (like retry policy tests) no longer create unused connections that race during teardown.

2. **Connection readiness + error handlers** (`bullmq-job-queue.ts`, `bullmq-job-worker.ts`): Before closing, `waitUntilReady()` ensures connections finish initializing. Error event listeners on Queue and Worker prevent unhandled EventEmitter crashes from BullMQ's internal connection management.

3. **Test teardown hardening** (`bullmq-queue.integration.test.ts`): Separated try-catch blocks so `close()` always runs even if `obliterate()` fails. Added a targeted `process.on('unhandledRejection')` handler scoped to this test file as a safety net for BullMQ Worker's private blockingConnection.
