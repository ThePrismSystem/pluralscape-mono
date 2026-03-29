---
# api-p4th
title: Register webhook delivery BullMQ job
status: todo
type: task
priority: high
created_at: 2026-03-29T02:07:28Z
updated_at: 2026-03-29T03:03:50Z
parent: api-9wze
---

Wire pending webhook deliveries into the BullMQ job system. Create a job handler in apps/api/src/jobs/ following established patterns (blob-s3-cleanup, audit-log-cleanup). Have dispatchWebhookEvent() enqueue a job after inserting the pending delivery record.

\n\n## Development Approach\n\nAll code must be written test-first using strict TDD (Red -> Green -> Refactor). Use `/tdd` workflow.
