---
# ps-8oxs
title: "PR #497 review fix-ups"
status: in-progress
type: task
priority: normal
created_at: 2026-04-19T19:45:34Z
updated_at: 2026-04-19T20:24:08Z
---

Address critical/important/suggestion findings from multi-agent review of PR #497. See docs/superpowers/plans/2026-04-19-pr-497-review-fixes.md

- [x] Widen ALLOW_IN_MEMORY_CACHE gate

- Task 1 reviewed: spec compliant, code quality approved-with-note (dual env surface tradeoff documented in test; not a blocker)

- [x] Mobile logger hardening (defaultRedact + JSON.stringify safety)

- [x] Drop \_resetI18nDepsForTesting re-export shim

- [x] Assertion-quality guard fails on tooling errors

- [x] Negative test for assertion-quality guard

- [x] Strip rot-prone comments

- [x] Delete import-sp/engine/checkpoint barrel

- [x] Tighten selectedCategories Zod schema + drop test casts

- [x] Write-path test for markRealPrivacyBucketsMapped
