---
# ps-r5p7
title: "M9a closeout: LOC ceilings as ESLint max-lines rules"
status: in-progress
type: feature
priority: high
created_at: 2026-04-30T19:46:18Z
updated_at: 2026-04-30T21:21:28Z
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
