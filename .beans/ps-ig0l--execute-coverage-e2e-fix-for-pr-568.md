---
# ps-ig0l
title: "Execute coverage + E2E fix for PR #568"
status: completed
type: task
priority: normal
created_at: 2026-04-27T04:10:27Z
updated_at: 2026-04-27T04:29:32Z
---

Lift branch coverage 88.9% to ≥89.25% (target 89.38%) and fix tags.spec.ts:118. Per docs/superpowers/plans/2026-04-27-pr568-coverage-and-e2e-fix.md.

## Summary of Changes

5 commits added to PR1 branch (refactor/ps-q8vs-pr2-bucket-content-tag-union):

1. `69a7ccdf` test(api) — parametrize decode tests over 21 entityType variants (+18 branches)
2. `4ac0536a` test(sync) — cover uncovered branches in post-merge-validator (+17 branches)
3. `28d8f6ea` chore(test) — exclude type-only files and SoT manifest from coverage
4. `1fbd4cdc` test(api-e2e) — use UUID-format IDs in tags.spec fixtures
5. `6f423d40` chore(beans) — file M15 umbrella for remaining low-branch business-logic files

**Result:**

- Branch coverage 88.9% → 89.29% (+35 branches covered, +0.39 pp)
- E2E tags.spec passes
- M15 umbrella bean ps-0rdy opened with 178 candidate files

PR comment: https://github.com/ThePrismSystem/pluralscape-mono/pull/568#issuecomment-4324104869
