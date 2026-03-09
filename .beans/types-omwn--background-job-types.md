---
# types-omwn
title: Background job types
status: completed
type: task
priority: normal
created_at: 2026-03-08T14:24:09Z
updated_at: 2026-03-09T06:05:37Z
parent: types-im7i
blocked_by:
  - types-av6x
---

Job queue types for BullMQ and SQLite fallback job processing.

## Scope

- `JobDefinition`: id, type (JobType), payload (unknown), status (JobStatus), attempts (number), maxAttempts (number), nextRetryAt (UnixMillis | null), error (string | null), createdAt, startedAt, completedAt
- `JobType`: 'sp-import' | 'pk-import' | 'json-export' | 'csv-export' | 'report-generation' | 'webhook-delivery' | 'push-notification-fanout' | 'account-purge' | 'bucket-key-rotation'
- `JobStatus`: 'pending' | 'processing' | 'completed' | 'failed' | 'dead-letter'
- `JobResult`: success (boolean), duration (number), output (unknown)
- `RetryPolicy`: maxAttempts, backoffType ('exponential'|'linear'), initialDelay (number)

## Acceptance Criteria

- [ ] JobDefinition covers all job types from features.md section 17
- [ ] All 9 job types defined
- [ ] Job lifecycle states (pending through dead-letter)
- [ ] Retry policy type
- [ ] Unit tests for job state transitions

## References

- features.md section 17 (Background Jobs)
- ADR 010 (Background Jobs)

## Summary of Changes

Created jobs.ts with JobId (branded), JobType (9 types), JobStatus (5 statuses), RetryPolicy, JobResult, JobDefinition. Branch: feat/types-infrastructure.
