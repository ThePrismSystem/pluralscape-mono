---
# api-0zzu
title: Parallelise S3 blob cleanup deletes
status: todo
type: task
priority: high
created_at: 2026-04-20T09:21:35Z
updated_at: 2026-04-20T09:21:35Z
parent: api-v8zu
---

Finding [P3] from audit 2026-04-20. apps/api/src/jobs/blob-s3-cleanup.ts:43-53. S3 deletes sequential in for-loop with per-item heartbeat. Fix: Promise.allSettled in batches of 10-20.
