---
# api-9qs2
title: Add Zod validation to deserialized Redis/JSON data at trust boundaries
status: completed
type: task
priority: normal
created_at: 2026-04-14T09:29:36Z
updated_at: 2026-04-14T14:53:35Z
---

AUDIT recurring pattern: JSON.parse then as-cast without runtime validation. Affects: entity-pubsub.ts:35, valkey-idempotency-store.ts:52, queue bullmq-job-queue.ts (4 instances). Tampered data propagates silently.

## Summary of Changes\n\nAdded Zod schemas at 6 trust boundaries: EntityChangeEventSchema in entity-pubsub, CachedResponseSchema in valkey-idempotency-store, StoredJobDataSchema in bullmq-job-queue (4 parse sites). All fail-closed.
