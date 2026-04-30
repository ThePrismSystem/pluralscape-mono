---
# api-rh0a
title: "T2 api services test splits: 16 files mirroring api-6l1q verb structure"
status: completed
type: task
priority: normal
created_at: 2026-04-30T05:02:07Z
updated_at: 2026-04-30T13:03:11Z
parent: ps-36rg
blocked_by:
  - sync-96hx
  - db-5bu5
  - ps-ga25
---

Sixteen service test files in apps/api/src/**tests**/services/. Mirror the verb-file split structure from the api-6l1q service refactor (services/<domain>/{create,update,...}.ts).

## Files

- [x] auth.service.test.ts (1,454)
- [x] analytics.service.test.ts (1,245)
- [x] member.service.integration.test.ts (1,122)
- [x] key-rotation.service.integration.test.ts (955)
- [x] fronting-session.service.integration.test.ts (945)
- [x] board-message.service.integration.test.ts (879)
- [x] check-in-record.service.test.ts (874)
- [x] fronting-session.service.test.ts (862)
- [x] timer-config.service.test.ts (856)
- [x] group.service.test.ts (848)
- [x] member.service.test.ts (813)
- [x] import-job.service.integration.test.ts (796)
- [x] field-value.service.test.ts (790)
- [x] webhook-config.service.test.ts (789)
- [x] fronting-comment.service.test.ts (778)
- [x] switch-alert-dispatcher.integration.test.ts (762)

## Acceptance

- pnpm vitest run --project api passes (unit)
- pnpm vitest run --project api-integration passes
- Coverage unchanged or higher

## Out of scope

- Service code changes (all api-6l1q service refactors already merged)

## Summary of Changes

Split all 16 oversized service test files into per-verb directories mirroring the service layer structure. Each original file (762–1,454 LOC) was replaced with 2–5 focused files ≤500 lines each, organized under `services/<domain>/` subdirectories. All 5,243 unit tests and 1,237 integration tests pass with zero lint/typecheck errors.
