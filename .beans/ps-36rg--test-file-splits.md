---
# ps-36rg
title: Test file splits
status: in-progress
type: epic
created_at: 2026-04-21T13:54:37Z
updated_at: 2026-04-21T13:54:37Z
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
