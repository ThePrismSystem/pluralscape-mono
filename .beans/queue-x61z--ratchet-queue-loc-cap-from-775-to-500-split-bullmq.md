---
# queue-x61z
title: Ratchet queue LOC cap from 775 to 500 (split bullmq-job-queue.ts)
status: completed
type: task
priority: normal
created_at: 2026-05-01T11:37:32Z
updated_at: 2026-05-01T12:20:57Z
parent: ps-cd6x
---

Tier B ratchet follow-up from ps-r5p7. Split packages/queue/src/adapters/bullmq/bullmq-job-queue.ts (currently 767 LOC) using barrel pattern, then lower the cap value in tooling/eslint-config/loc-rules.js from 775 to 500. Spec: docs/superpowers/specs/2026-04-30-loc-ceilings-eslint-rules-design.md

## Summary of Changes

Split packages/queue/src/adapters/bullmq/bullmq-job-queue.ts (767 LOC) into:

- bullmq-job-queue.ts — BullMQJobQueue class (500 LOC, hits cap exactly)
- bullmq-job-queue.helpers.ts — formatZodIssues, jobIdOf, parseJobDataOrThrow, mapStatusToBullMQStates, scanRedisKeys, extractRedisOptions (124 LOC)
- bullmq-cancelled-store.ts — CancelledJobStore class wrapping cancelled-jobs Redis hash (91 LOC)
- bullmq-job-queue.operations.ts — performEnqueue, performListJobs delegated implementations with explicit OperationContext (188 LOC)

Lowered B12 cap in tooling/eslint-config/loc-rules.js from 775 to 500. BullMQJobQueue's public API unchanged; obliterate/cancel/retry/getJob/listJobs/countJobs all delegate to CancelledJobStore. Reused parseJobDataOrThrow and jobIdOf to remove duplicate safeParse blocks.

Verified: pnpm typecheck, pnpm vitest run --project queue (278 passed), pnpm lint --filter=@pluralscape/queue, pnpm lint:loc — all pass.
