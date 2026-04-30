---
# ps-36rg
title: Test file splits
status: completed
type: epic
priority: normal
created_at: 2026-04-21T13:54:37Z
updated_at: 2026-04-30T18:54:00Z
parent: ps-cd6x
---

19 test files exceed 1,000 lines. Split the three worst by concern into standalone files for reviewability; umbrella the remaining 16 for systematic cleanup following the established pattern.

## Named splits (one child task each)

- packages/sync/src/**tests**/post-merge-validator.test.ts (2,728 LOC)
  → split by concern: tombstones / hierarchy-cycles / sort-order / per-entity normalizers
- packages/db/src/**tests**/rls-policies.integration.test.ts (2,470 LOC)
  → split by table group: auth, system-scoped, account-scoped, dual, key-grants-asymmetric
- packages/import-core/src/**tests**/import-engine.test.ts (2,195 LOC)
  → split by phase: checkpoint resume / entity ordering / error classification / persister contract

## Umbrella

One child task covering the remaining 16 files >1,000 LOC with an internal checklist, one PR per file, following the pattern established by the three named splits.

## Acceptance per file

- Existing test count unchanged or higher (no coverage loss)
- Each resulting file ≤600 LOC (stretch target: 400)
- pnpm vitest run --project <name> passes for the affected package

## Spec reference

docs/superpowers/specs/2026-04-21-m9a-closeout-hardening-design.md

## Summary of Changes

Epic completed across 12 child PRs (#588 bean restructuring + #589-600 splits) on 2026-04-30.

### PRs merged

- **Tier 1 (named-pattern, serial):** #589 sync-96hx (post-merge-validator), #590 db-5bu5 (rls-policies), #591 ps-ga25 (import-engine)
- **Tier 2 Wave A:** #592 mobile-jxox, #593 db-oll6 (sqlite), #594 api-rh0a (services)
- **Tier 2 Wave B:** #595 sync-vmv4, #596 api-4cmq (ws/trpc), #597 db-im18 (pg)
- **Tier 2 Wave C:** #598 ps-vrac (import-sp), #599 ps-ro3q (queue), #600 crypto-mdzz (crypto)

### Audit at completion

- Zero `.test.ts`/`.test.tsx`/`.bench.ts` files ≥750 LOC remain in any `__tests__/` directory across the monorepo
- All resulting files from the splits are ≤500 LOC (most under 350)
- All test-only helper files are ≤500 LOC
- Files originally between 500-749 LOC were below the epic's 750 threshold and remain unchanged (intentional out-of-scope per spec)
- All packages' tests pass on green CI through merge of each PR

### DRY consolidations across the epic

Each PR extracted shared fixtures/setup into per-domain helpers — helper files include validator-fixtures, rls-test-helpers, engine-fixtures, conflict-resolution-fixtures, schema-fixtures, ws-client-adapter-fixtures, runtime-hardening-fixtures, schema-parity-fixtures, ws-handlers-fixtures, message-router-fixtures, structure-fixtures, bullmq-test-fixtures, key-lifecycle-fixtures, and others. These collapsed repeated boilerplate (sodium init, mock factories, harnesses, RLS context setup) across sibling tests.

### Notable infra change

PR #599 (queue) added `fileParallelism: false` for the `queue-integration` vitest project to preserve single-process semantics after the split — documented via a `SHARED_INFRA_INTEGRATION_PROJECTS` set in vitest.config.ts.
