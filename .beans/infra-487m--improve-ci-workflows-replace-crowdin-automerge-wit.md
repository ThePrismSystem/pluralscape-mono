---
# infra-487m
title: "Improve CI workflows: replace crowdin-automerge with native auto-merge + moderate optimizations"
status: completed
type: task
priority: normal
created_at: 2026-04-19T01:43:35Z
updated_at: 2026-04-19T03:56:12Z
---

Replace custom crowdin-automerge workflow with native gh pr merge --auto + branch ruleset scoped to github-actions[bot]. Extract composite setup action, drop needs:[lint,typecheck] gates on fast jobs, refine concurrency cancel-in-progress. Keep separate crowdin workflows (responsibility boundary). Larger runners skipped (paid tier on public repos).

## Spec

See `docs/superpowers/specs/2026-04-18-ci-workflow-improvements-design.md` (local-only, gitignored).

## Todos

### Part A — Replace crowdin-automerge

- [x] Create branch ruleset via gh api (ruleset 15254372, active — evaluate mode not available on non-Enterprise plan)
- [x] Enable native auto-merge in repo Settings
- [x] Add gh pr merge --auto step to crowdin-sync.yml (PR #476, commit 38d106eb)
- [x] Delete crowdin-automerge.yml workflow (PR #476, commit 61016534)
- [x] Delete scripts/crowdin-automerge-guard.ts (PR #476, commit 0f58a92f)
- [x] Delete scripts/crowdin/automerge/evaluate.ts and gh.ts + tests (PR #476, commit 0f58a92f)
- [x] Remove crowdin:automerge-guard script from package.json (PR #476, commit 0f58a92f)
- [ ] Remove CROWDIN_AUTOMERGE_DRY_RUN repo variable (still to-do — after first successful Crowdin sync PR auto-merge)

### Part B — CI structural changes

- [x] Create .github/actions/setup-pnpm/action.yml composite (PR #474, commit 997cbda8)
- [x] Replace boilerplate in ci.yml jobs with composite use (PR #474, commit 5798be94)
- [x] Drop needs:[lint,typecheck] from: migrations, security, openapi, trpc-parity, scope-check (PR #474, commit d14f9dc4)
- [x] Refine concurrency.cancel-in-progress to PR-only in ci.yml and codeql.yml (PR #474, commit 1c9b718c)

### Rollout order

- [x] Land Part B first (PR #474 open, waiting for CI)
- [x] Create ruleset (active, evaluate mode not available on plan)
- [x] Ruleset already active from creation
- [x] Land Part A in PR #476 (merged as commit 42b2ba01)
- [ ] Manually trigger crowdin-sync to validate end-to-end (follow-up)

## Summary of Changes

**Phase B (CI structural) — merged in PR #474:**

- Extracted .github/actions/setup-pnpm composite action (with actions/checkout in each job, since local composites load from workspace)
- Dropped needs:[lint,typecheck] from migrations/security/openapi/trpc-parity/scope-check
- Gated concurrency.cancel-in-progress on pull_request in ci.yml and codeql.yml

**Ruleset (active):** ID 15254372, restricts creation/update/deletion on chore/crowdin-translations to Pluralscape Crowdin Bot App (id 3426939) and repo admins. evaluate mode was not available on this plan tier.

**Phase A (Crowdin automerge replacement) — merged in PR #476 (42b2ba01):**

- crowdin-sync.yml mints a short-lived GitHub App installation token and uses it for checkout, crowdin-action push, and gh pr merge --auto --squash --delete-branch
- Deleted crowdin-automerge.yml + scripts/crowdin-automerge-guard.ts + scripts/crowdin/automerge/\* + associated tests
- Removed crowdin:automerge-guard npm script
- Updated docs/i18n/crowdin-operations.md for the new flow

**Extras that rode along in PR #476:**

- fix(crowdin): find glossary by project association, not by name (was blocking crowdin:setup)
- CodeQL triage fixes: TOCTOU in pk-file-source, WSS-only guard, array narrowing in sync materializer, HTTPS-only SP import baseUrl
- Follow-up beans: ps-aj1j (SP import UX), ps-rcpk (isPlainRecord helper)

**Residual follow-ups (not blocking completion):**

- Manually trigger crowdin-sync after a Crowdin translator touches a string, verify end-to-end auto-merge works
- Remove CROWDIN_AUTOMERGE_DRY_RUN repo variable after that verification
