---
# api-vhwr
title: Add M4 E2E tests
status: completed
type: task
priority: high
created_at: 2026-03-24T09:24:08Z
updated_at: 2026-03-24T10:41:44Z
parent: ps-4ioj
---

Zero E2E tests for any M4 feature. Need specs for fronting session lifecycle, webhook config CRUD, timer/check-in flow.

## Summary of Changes\n\nCreated 3 E2E spec files:\n- `apps/api-e2e/src/tests/fronting/fronting-sessions.spec.ts` (2 tests): full lifecycle + co-fronting with simultaneous sessions\n- `apps/api-e2e/src/tests/webhooks/webhook-flow.spec.ts` (1 test): webhook config lifecycle with secret-not-returned verification\n- `apps/api-e2e/src/tests/timers/timer-check-in.spec.ts` (1 test): timer config + check-in respond/dismiss flow\n\nAlso fixed pre-existing bug: added missing fronting-session and fronting-comment audit event types to DB CHECK constraint (migration 0010).
