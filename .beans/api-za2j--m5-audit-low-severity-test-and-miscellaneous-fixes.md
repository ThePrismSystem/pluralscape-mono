---
# api-za2j
title: M5 audit low-severity test and miscellaneous fixes
status: completed
type: task
priority: low
created_at: 2026-03-26T07:43:55Z
updated_at: 2026-03-26T12:43:58Z
parent: ps-106o
---

Batch of low-severity test and miscellaneous findings from M5 audit.

## Tasks

- [x] L15: Extract shared audit assertion helper; replace duplicates in 3 integration test files
- [x] L16: Replace hard-coded voter/option IDs in E2E voting tests with UUIDs
- [x] L17: Add webhook-config update route test
- [x] L18: Simplify .returning() in cleanup to avoid fetching full IDs
- [x] L19: Combine webhook delivery worker's 2 sequential queries into a JOIN
- [x] L20: Skipped — hooks already receive entityId directly, no re-query
- [x] L21: Convert TODO in rotation.spec.ts:18 to bean api-7spq
- [x] L22: Document DNS rebinding TOCTOU in webhook delivery (accepted risk)
- [x] L23: Scope webhook secret variable to minimize log exposure risk

## Summary of Changes

- Extracted shared expectSingleAuditEvent helper; replaced duplicates across 3 integration test files
- Replaced all hard-coded voter/option IDs in E2E voting tests with crypto.randomUUID()
- Added webhook-config update route test (update.test.ts)
- Simplified .returning() in webhook delivery cleanup
- Combined 2 sequential queries into a single JOIN in webhook delivery worker
- Converted rotation.spec.ts TODO to bean api-7spq
- Added DNS rebinding TOCTOU documentation in webhook delivery worker
- Scoped webhook secret variable inside transaction callback
- Skipped L20 (non-issue)
