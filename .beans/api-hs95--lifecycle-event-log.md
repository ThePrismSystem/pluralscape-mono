---
# api-hs95
title: Lifecycle event log
status: completed
type: task
priority: normal
created_at: 2026-03-16T11:57:26Z
updated_at: 2026-03-18T05:35:25Z
parent: api-00hp
blocked_by:
  - api-o89k
  - api-b0nb
  - api-wq3i
---

POST .../lifecycle-events (eventType discriminant, occurredAt, notes, type-specific fields in encryptedData). GET list (cursor paginated by occurredAt, filter by eventType). GET by ID. Append-only (no update/delete, no version column). 13 event types.
