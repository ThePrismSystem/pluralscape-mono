---
# ps-74xz
title: Validate BullMQ job.data with Zod in all write-path methods
status: completed
type: bug
priority: high
created_at: 2026-04-20T09:22:51Z
updated_at: 2026-04-20T11:50:35Z
parent: ps-v7el
---

Finding [Security H] from audit 2026-04-20. packages/queue/src/bullmq-job-queue.ts L338,387,417,491,530,644,659. Bare 'job.data as StoredJobData' casts in dequeue, acknowledge, fail, retry, cancel, heartbeat, findStalledJobs. Only getJob and listJobs run StoredJobDataSchema.safeParse. Corrupted job data in Redis bypasses validation. Fix: use StoredJobDataSchema.safeParse and throw QueueCorruptionError on failure.

## Summary of Changes

Extracted parseJobDataOrThrow(job: BullMQJob): StoredJobData helper in packages/queue/src/adapters/bullmq/bullmq-job-queue.ts that runs StoredJobDataSchema.safeParse and throws QueueCorruptionError on failure. Replaced 7 bare 'job.data as StoredJobData' casts in dequeue, acknowledge, fail, retry, cancel, heartbeat, and findStalledJobs — each method now fails closed when stored job data disagrees with the discriminated schema.

Added 7 integration tests (one per method) in bullmq-queue.integration.test.ts that seed a corrupted (type, payload) pair in the BullMQ hash and assert QueueCorruptionError. findStalledJobs was rewritten to parse once per job and reuse the validated shape (both reads were casts).
