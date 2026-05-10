---
# infra-kmnl
title: Batch renovate/dependabot dependency updates
status: in-progress
type: task
created_at: 2026-05-10T01:45:29Z
updated_at: 2026-05-10T01:45:29Z
---

Apply all open renovate and dependabot PRs (12 PRs as of 2026-05-09) into a single batch branch, regenerate lockfile, run full verify suite, fix any issues, then push and open a single PR.

Source PRs:

- #619 dependabot: hono 4.12.18
- #618 dependabot: fast-uri 3.1.2
- #617 renovate: hono 4.12.18 [security] (duplicate of #619)
- #614 renovate: bullmq 5.76.6
- #613 renovate: aws-sdk-js-v3 monorepo 3.1045.0
- #612 renovate: tanstack-query 5.100.9
- #611 renovate: github-actions
- #610 renovate: expo monorepo
- #609 renovate: dev dependencies (patch/minor)
- #608 renovate: react-i18next 17.0.7
- #606 renovate: @hono/node-server 2.0.2
- #605 renovate: @aws-sdk/xml-builder>fast-xml-parser 5.5.12

## Todo

- [ ] Stash unrelated working-tree changes
- [ ] Branch from main
- [ ] Apply all package.json/workflow changes from each PR
- [ ] Regenerate pnpm-lock.yaml
- [ ] Run /verify suite
- [ ] Fix any issues
- [ ] Push branch and open PR
