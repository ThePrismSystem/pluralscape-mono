---
# ps-8oxs
title: "PR #497 review fix-ups"
status: completed
type: task
priority: normal
created_at: 2026-04-19T19:45:34Z
updated_at: 2026-04-19T21:07:52Z
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

- [x] Follow-up beans created (M10 UI design + M12 data interpolation)

## Summary of Changes

- Widened ALLOW_IN_MEMORY_CACHE gate across i18n, idempotency, rate-limit, notify/sync pub/sub (Task 1).
- Mobile logger: recursive defaultRedact + JSON.stringify try/catch (Task 2).
- Dropped \_resetI18nDepsForTesting re-export shim (Task 3).
- Assertion-quality guard fails on tooling errors + negative test (Tasks 4-5).
- Stripped rot-prone comments from import state JSDoc + engine (Task 6).
- Deleted import-sp/src/engine/checkpoint.ts barrel (Task 7).
- Tightened selectedCategories Zod schema + dropped test casts (Task 8).
- markRealPrivacyBucketsMapped write-path test (Task 9).
- Filed follow-up beans mobile-5bi3 (M10 UI) + mobile-fk47 (M12 data, blocked-by mobile-5bi3) (Task 10).
- Fixed E2E regression: VITEST env leaked from vitest parent into spawned API, silenced start() gate. Strip VITEST in tooling/test-utils/src/e2e/api-server.ts.

Merged via admin squash as 7b469e38 on 2026-04-19.
