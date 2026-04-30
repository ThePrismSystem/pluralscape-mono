---
# api-rh0a
title: "T2 api services test splits: 16 files mirroring api-6l1q verb structure"
status: todo
type: task
priority: normal
created_at: 2026-04-30T05:02:07Z
updated_at: 2026-04-30T05:02:13Z
parent: ps-36rg
blocked_by:
  - sync-96hx
  - db-5bu5
  - ps-ga25
---

Sixteen service test files in apps/api/src/**tests**/services/. Mirror the verb-file split structure from the api-6l1q service refactor (services/<domain>/{create,update,...}.ts).

## Files

- [ ] auth.service.test.ts (1,454)
- [ ] analytics.service.test.ts (1,245)
- [ ] member.service.integration.test.ts (1,122)
- [ ] key-rotation.service.integration.test.ts (955)
- [ ] fronting-session.service.integration.test.ts (945)
- [ ] board-message.service.integration.test.ts (879)
- [ ] check-in-record.service.test.ts (874)
- [ ] fronting-session.service.test.ts (862)
- [ ] timer-config.service.test.ts (856)
- [ ] group.service.test.ts (848)
- [ ] member.service.test.ts (813)
- [ ] import-job.service.integration.test.ts (796)
- [ ] field-value.service.test.ts (790)
- [ ] webhook-config.service.test.ts (789)
- [ ] fronting-comment.service.test.ts (778)
- [ ] switch-alert-dispatcher.integration.test.ts (762)

## Acceptance

- pnpm vitest run --project api passes (unit)
- pnpm vitest run --project api-integration passes
- Coverage unchanged or higher

## Out of scope

- Service code changes (all api-6l1q service refactors already merged)
