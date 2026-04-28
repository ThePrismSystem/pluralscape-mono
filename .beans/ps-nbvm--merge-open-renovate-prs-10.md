---
# ps-nbvm
title: Merge open Renovate PRs (10)
status: completed
type: task
priority: normal
created_at: 2026-04-28T08:10:48Z
updated_at: 2026-04-28T10:44:16Z
---

Process all 10 open Renovate PRs:

- #573 github actions
- #569 nodemailer 8.0.7
- #566 hono 4.12.15
- #567 i18next 26.0.8
- #570 dev-dependencies (patch/minor)
- #577 @journeyapps/wa-sqlite 1.7.0
- #576 @electric-sql/pglite 0.4.5
- #575 aws-sdk-js-v3 monorepo 3.1038.0
- #574 tanstack-query monorepo 5.100.5
- #572 expo monorepo

Workflow per PR:

1. gh pr update-branch (rebase to main)
2. gh pr review --approve
3. gh pr merge --auto --squash --delete-branch
4. wait for merged state

## Merge order

- [x] #573 github actions
- [x] #569 nodemailer 8.0.7
- [x] #566 hono 4.12.15
- [x] #567 i18next 26.0.8
- [x] #570 dev-dependencies (patch/minor)
- [x] #577 wa-sqlite 1.7.0
- [x] #576 pglite 0.4.5
- [x] #575 aws-sdk-js-v3 3.1038.0
- [x] #574 tanstack-query 5.100.5
- [x] #572 expo monorepo

## Summary of Changes

Merged all 10 Renovate dependency PRs:

- #566 hono 4.12.15
- #576 @electric-sql/pglite 0.4.5
- #573 github actions
- #569 nodemailer 8.0.7
- #567 i18next 26.0.8
- #570 dev-dependencies (patch/minor)
- #577 @journeyapps/wa-sqlite 1.7.0
- #574 tanstack-query 5.100.5
- #575 aws-sdk-js-v3 3.1038.0
- #572 expo monorepo

Workflow per PR: rebase via `gh api -X PUT .../update-branch`, re-approve (dismiss_stale_reviews_on_push fires after each push), auto-merge --squash --delete-branch. Repeated until all merged. Encountered intermittent `sh: 1: node-gyp: not found` install flakes on the Scope Coverage Check job (likely cache-miss + missing prebuilt for node 24.15.0); resolved via `gh run rerun <run-id> --failed`.
