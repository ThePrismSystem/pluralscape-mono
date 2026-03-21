---
# api-u3jt
title: Add jitterFraction 0.2 to default retry policies
status: completed
type: task
priority: normal
created_at: 2026-03-16T09:05:23Z
updated_at: 2026-03-21T11:14:30Z
parent: api-0zl4
blocked_by:
  - api-g954
---

Add jitterFraction: 0.2 to all retry policies in packages/queue/src/policies/default-policies.ts. The field already exists on the RetryPolicy type and is supported by the backoff calculator in backoff.ts. Per docs/planning/api-specification.md Section 4.

## Summary of Changes\n\nAdded `jitterFraction: 0.2` to `DEFAULT_RETRY_POLICY`, `HEAVY_BACKOFF`, and all 10 inline policies in `DEFAULT_RETRY_POLICIES`. Added test asserting every policy has jitterFraction 0.2.
