---
# infra-487m
title: "Improve CI workflows: replace crowdin-automerge with native auto-merge + moderate optimizations"
status: in-progress
type: task
priority: normal
created_at: 2026-04-19T01:43:35Z
updated_at: 2026-04-19T01:48:17Z
---

Replace custom crowdin-automerge workflow with native gh pr merge --auto + branch ruleset scoped to github-actions[bot]. Extract composite setup action, drop needs:[lint,typecheck] gates on fast jobs, refine concurrency cancel-in-progress. Keep separate crowdin workflows (responsibility boundary). Larger runners skipped (paid tier on public repos).

## Spec

See `docs/superpowers/specs/2026-04-18-ci-workflow-improvements-design.md` (local-only, gitignored).

## Todos

### Part A — Replace crowdin-automerge

- [ ] Create branch ruleset via `gh api` (enforcement: evaluate first, then active)
- [ ] Enable native auto-merge in repo Settings
- [ ] Add `gh pr merge --auto` step to crowdin-sync.yml
- [ ] Delete crowdin-automerge.yml workflow
- [ ] Delete scripts/crowdin-automerge-guard.ts
- [ ] Delete scripts/crowdin/automerge/evaluate.ts and gh.ts + tests
- [ ] Remove crowdin:automerge-guard script from package.json
- [ ] Remove CROWDIN_AUTOMERGE_DRY_RUN repo variable (after first successful auto-merge)

### Part B — CI structural changes

- [ ] Create .github/actions/setup-pnpm/action.yml composite
- [ ] Replace boilerplate in ci.yml jobs with composite use
- [ ] Drop needs:[lint,typecheck] from: migrations, security, openapi, trpc-parity, scope-check
- [ ] Refine concurrency.cancel-in-progress to PR-only in ci.yml and codeql.yml

### Rollout order

- [ ] Land Part B first (lower risk)
- [ ] Create ruleset in evaluate mode
- [ ] Flip ruleset to active after first clean run
- [ ] Land Part A in one PR (workflow change + deletes)
- [ ] Manually trigger crowdin-sync to validate end-to-end
