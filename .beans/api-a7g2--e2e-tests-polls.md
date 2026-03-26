---
# api-a7g2
title: "E2E tests: polls"
status: completed
type: task
priority: normal
created_at: 2026-03-25T05:59:20Z
updated_at: 2026-03-25T23:53:27Z
parent: api-8lt2
blocked_by:
  - api-zdqb
---

apps/api-e2e/src/tests/polls/crud.spec.ts (poll lifecycle) + voting.spec.ts (voting flows). Cover: create with options, vote, multi-vote, veto, abstain, close, archive/delete, consensus analytics, auth, error codes.

## Summary of Changes\n\nCreated crud.spec.ts (3 tests: lifecycle, status filter, cross-system) and voting.spec.ts (6 tests: cast/list/duplicate, multi-vote, abstain, veto, closed poll, delete with votes). Added createPoll helper to entity-helpers.ts.
