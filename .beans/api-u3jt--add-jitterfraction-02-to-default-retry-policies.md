---
# api-u3jt
title: Add jitterFraction 0.2 to default retry policies
status: todo
type: task
created_at: 2026-03-16T09:05:23Z
updated_at: 2026-03-16T09:05:23Z
blocked_by:
  - api-g954
---

Add jitterFraction: 0.2 to all retry policies in packages/queue/src/policies/default-policies.ts. The field already exists on the RetryPolicy type and is supported by the backoff calculator in backoff.ts. Per docs/planning/api-specification.md Section 4.
