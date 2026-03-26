---
# api-8atf
title: M5 audit low-severity simplification and DB fixes
status: completed
type: task
priority: low
created_at: 2026-03-26T07:43:55Z
updated_at: 2026-03-26T12:29:09Z
parent: ps-106o
---

Batch of low-severity simplification, DB, and miscellaneous findings from M5 audit.

## Tasks

- [x] L10: Move optionalBooleanQueryParam from acknowledgement.ts to shared query-params.ts
- [x] L11: Extract duplicated delete pattern across 3+ services to entity-lifecycle.ts
- [x] L12: Skipped — abstraction adds complexity for marginal benefit
- [x] L13: Remove redundant unique constraint messages(id, timestamp) — PK already enforces
- [x] L14: Add CHECK constraint for poll_votes.voter IS NOT NULL

## Summary of Changes

- Extracted optionalBooleanQueryParam to shared query-params.ts
- Added deleteEntity() to entity-lifecycle.ts; refactored 4 services to use it
- Removed redundant messages unique constraint (migration 0007)
- Added CHECK constraint poll_votes_voter_not_null (migration 0007)
- Skipped L12 (get-by-id extraction) — minimal benefit
