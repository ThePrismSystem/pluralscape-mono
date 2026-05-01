---
# ps-r5p7
title: "M9a closeout: LOC ceilings as ESLint max-lines rules"
status: completed
type: feature
priority: high
created_at: 2026-04-30T19:46:18Z
updated_at: 2026-05-01T11:37:49Z
parent: ps-cd6x
---

Final M9a effort: codify LOC ceilings as ESLint `max-lines` rules across the codebase by domain. Mix of (a) final standards (tests=750 post-epic, services=450 already set, routes/middleware tight) and (b) lockstep-with-current-max for areas with outliers (sync, mobile, lib, ws) with follow-up ratcheting beans.

Builds on completed precedents: ps-lg9y (services LOC cap), ps-e0tl (lower based on post-refactor LOC), ps-36rg (test split epic — no test >750).

## Spec

Design spec written to `docs/superpowers/specs/2026-04-30-loc-ceilings-eslint-rules-design.md` (gitignored, local-only).

Decisions locked:

- Counting: ESLint default (no skipBlankLines, no skipComments) — matches `wc -l`
- Tier A targets (14 globs) + Tier B lockstep (6 globs) = 21 blocks total
- 100% coverage of 3,104 audited files
- 8 upfront splits required: trpc account.ts, trpc structure.ts, services hierarchy-service-factory.ts, types ids.ts, db helpers/enums.ts, import-sp engine/import-engine.ts, api-e2e entity-helpers.ts, api-e2e endpoint-registry.ts
- Single PR, 10 commits (8 splits + 1 rule landing + 1 docs)
- Tier B ratchet beans (6) created post-merge, NOT children of ps-r5p7

## Audit artifacts

`.tmp/loc-audit/` (local-only):

- `categorized.tsv` — every `.ts`/`.tsx` file under apps/ and packages/ tagged with kind+area
- `final-coverage.py` — verifies 100% glob coverage
- `effective-loc.py` — raw vs effective LOC sample

## Plan

Implementation plan written to `docs/superpowers/plans/2026-04-30-loc-ceilings-eslint-rules.md` (gitignored, local-only).

13 tasks: 8 split commits + 1 rule-landing commit + 1 ADR-decision (skipped) + 11 final verify + 12 push/PR/merge + 13 post-merge ratchet bean creation.

Single PR on `refactor/loc-ceilings` branch from a worktree at `/home/theprismsystem/git/refactor/loc-ceilings`.

## Summary of Changes

Landed 21 ESLint max-lines blocks in tooling/eslint-config/loc-rules.js (single source of truth) covering 100% of 3,104 source/test files under apps/ and packages/. Counting algorithm: ESLint default (no skipBlankLines/skipComments) — matches `wc -l`.

### Implementation

- Single PR (#602): https://github.com/ThePrismSystem/pluralscape-mono/pull/602
- 12 commits: 8 file splits + 2 tooling-script extensions (trpc-parity + scope-check recursion) + rule landing + bean closeouts
- All 13 CI checks green; merged 2026-05-01

### Splits performed (8 files)

- apps/api-e2e/src/fixtures/entity-helpers.ts (520 to <=400)
- apps/api-e2e/src/fixtures/endpoint-registry.ts (509 to <=400)
- apps/api/src/services/hierarchy-service-factory.ts (501 to <=450)
- apps/api/src/trpc/routers/account.ts (390 to <=350)
- apps/api/src/trpc/routers/structure.ts (374 to <=350)
- packages/db/src/helpers/enums.ts (610 to <=500)
- packages/import-sp/src/engine/import-engine.ts (568 to <=500)
- packages/types/src/ids.ts (467 to <=450)

### Architecture: two-config setup

ESLint flat-config globs resolve against per-package CWD, so cross-package rules in shared base don't fire from per-package configs. Solution:

- tooling/eslint-config/loc-rules.js — single source of truth
- eslint.loc.config.js — root config that imports locRules
- pnpm lint:loc — wired into pre-push and CI

### Tooling extensions

- apps/api/scripts/trpc-parity-lib.ts: recurse into router subdirs
- scripts/check-scope-coverage.ts: handle ...spreadProcedures pattern

### Tier B ratchet follow-ups (6 beans created)

- api-lwk8 (api/lib 775 to 500)
- api-pr49 (api/ws 725 to 500)
- mobile-62f6 (mobile/src 850 to 500)
- sync-1vf5 (sync 1100 to 750)
- queue-x61z (queue 775 to 500)
- ps-p1zj (import-core 675 to 500)

Spec: docs/superpowers/specs/2026-04-30-loc-ceilings-eslint-rules-design.md
Plan: docs/superpowers/plans/2026-04-30-loc-ceilings-eslint-rules.md
