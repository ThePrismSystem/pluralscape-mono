---
# api-8gyw
title: Transfer session cleanup job
status: completed
type: task
priority: normal
created_at: 2026-03-19T11:39:42Z
updated_at: 2026-03-20T10:32:47Z
parent: crypto-og5h
---

Background job to expire pending device transfer sessions past expiresAt. Set status to expired.

## Acceptance Criteria

- Pending transfers past expiresAt marked as expired within 1 minute
- Does not affect already-approved or already-completed transfers
- Runs on configurable schedule (default: every minute)
- Idempotent — running twice doesn't cause errors
- Unit tests: create expired transfer, run job, verify status change

## Summary of Changes

- Added `device-transfer-cleanup` to `JobType` union, `JOB_TYPES` enum, `JobPayloadMap`, and `DEFAULT_RETRY_POLICIES`
- Created `packages/db/src/queries/device-transfer-cleanup.ts` with CTE-based batch update query
- Created `apps/api/src/jobs/device-transfer-cleanup.ts` handler
- Exported from `@pluralscape/db` barrel
