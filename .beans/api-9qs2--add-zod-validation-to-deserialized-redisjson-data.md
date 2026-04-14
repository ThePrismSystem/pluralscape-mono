---
# api-9qs2
title: Add Zod validation to deserialized Redis/JSON data at trust boundaries
status: todo
type: task
priority: normal
created_at: 2026-04-14T09:29:36Z
updated_at: 2026-04-14T09:29:36Z
---

AUDIT recurring pattern: JSON.parse then as-cast without runtime validation. Affects: entity-pubsub.ts:35, valkey-idempotency-store.ts:52, queue bullmq-job-queue.ts (4 instances). Tampered data propagates silently.
