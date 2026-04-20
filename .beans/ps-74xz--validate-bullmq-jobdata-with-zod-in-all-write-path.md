---
# ps-74xz
title: Validate BullMQ job.data with Zod in all write-path methods
status: todo
type: bug
priority: high
created_at: 2026-04-20T09:22:51Z
updated_at: 2026-04-20T09:22:51Z
parent: ps-v7el
---

Finding [Security H] from audit 2026-04-20. packages/queue/src/bullmq-job-queue.ts L338,387,417,491,530,644,659. Bare 'job.data as StoredJobData' casts in dequeue, acknowledge, fail, retry, cancel, heartbeat, findStalledJobs. Only getJob and listJobs run StoredJobDataSchema.safeParse. Corrupted job data in Redis bypasses validation. Fix: use StoredJobDataSchema.safeParse and throw QueueCorruptionError on failure.
