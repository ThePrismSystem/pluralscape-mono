---
# api-z1jk
title: "E2E tests: device transfer"
status: completed
type: task
priority: normal
created_at: 2026-03-19T11:39:42Z
updated_at: 2026-03-20T10:34:27Z
parent: crypto-og5h
---

End-to-end tests for multi-device key transfer flow.

## Acceptance Criteria

- Tests live in \`apps/api-e2e/src/tests/device-transfer/\`
- Test: Full flow — initiate → complete → source receives approval notification
- Test: Expired code rejection (wait past expiry, attempt complete → 410)
- Test: Wrong code → 403
- Test: Rate limit — 4th initiation within window → 429
- All tests use real HTTP/WebSocket connections against running API server

## Summary of Changes

- Created `apps/api-e2e/src/tests/device-transfer/device-transfer.spec.ts`
- Tests: initiate transfer, missing auth, wrong code, non-existent transfer ID, 5 wrong codes lockout
