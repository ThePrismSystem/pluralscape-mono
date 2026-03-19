---
# api-8gyw
title: Transfer session cleanup job
status: todo
type: task
priority: normal
created_at: 2026-03-19T11:39:42Z
updated_at: 2026-03-19T11:39:42Z
parent: crypto-og5h
---

Background job to expire pending device transfer sessions past expiresAt. Set status to expired.

## Acceptance Criteria

- Pending transfers past expiresAt marked as expired within 1 minute
- Does not affect already-approved or already-completed transfers
- Runs on configurable schedule (default: every minute)
- Idempotent — running twice doesn't cause errors
- Unit tests: create expired transfer, run job, verify status change
