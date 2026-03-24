---
# api-go73
title: "E2E: buckets key rotation flow"
status: completed
type: task
priority: high
created_at: 2026-03-24T12:46:14Z
updated_at: 2026-03-24T12:57:02Z
parent: api-n8od
---

E2E tests for bucket rotation initiate/claim/complete-chunk/progress

## Summary of Changes\n\nCreated apps/api-e2e/src/tests/buckets/rotation.spec.ts with 6 tests: rotation lifecycle on empty bucket, 404 error cases for non-existent rotations, validation error, wrong system 404. Includes TODO for full lifecycle once bucket creation API is available.
