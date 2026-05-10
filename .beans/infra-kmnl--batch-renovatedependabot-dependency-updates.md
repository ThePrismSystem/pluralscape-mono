---
# infra-kmnl
title: Batch renovate/dependabot dependency updates
status: completed
type: task
priority: normal
created_at: 2026-05-10T01:45:29Z
updated_at: 2026-05-10T02:01:47Z
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

- [x] Stash unrelated working-tree changes
- [x] Branch from main
- [x] Apply all package.json/workflow changes from each PR
- [x] Regenerate pnpm-lock.yaml
- [x] Run /verify suite
- [x] Fix any issues
- [x] Push branch and open PR

## Summary of Changes

Applied all 12 open renovate/dependabot PRs as a single batch on chore/deps-batch-renovate.

**Cherry-picked individually** (touched non-lockfile files):

- #611 github actions (pnpm/action-setup, codeql 4.35.4, postgres/valkey image digests)
- #619 hono 4.12.18 (apps/api/package.json + lockfile)
- #612 @tanstack/query-core override 5.100.9 (root package.json)
- #605 @aws-sdk/xml-builder>fast-xml-parser 5.5.12 (root package.json)

**Absorbed via pnpm update --recursive** (lockfile-only renovate PRs):

- #618 fast-uri 3.1.2
- #617 hono 4.12.18 [security] (duplicate of #619 at lockfile level)
- #614 bullmq 5.76.6
- #613 aws-sdk-js-v3 monorepo 3.1045.0
- #610 expo monorepo (~55.0.13 -> ~55.0.23 plus expo-\* siblings)
- #609 dev dependencies (commitlint, redocly, vitest, eslint, knip, turbo, etc.)
- #608 react-i18next 17.0.7
- #606 @hono/node-server 2.0.2

**pnpm-workspace.yaml catalog bumps:** pglite 0.4.5, react-query 5.100.9, drizzle-orm 0.45.2, eslint 10.3.0, happy-dom 20.9.0, react-dom 19.2.6, zod 4.4.3.

**Fix-up:**

- Restored @trpc/server catalog: refs in apps/api and packages/api-client that pnpm update --recursive unwrapped to literal 11.16.0.
- Removed redundant `as RotationApiClient` cast in rotation-worker test (newer @typescript-eslint/no-unnecessary-type-assertion caught it).

**Verification (run 8880):** format PASS, lint PASS, typecheck PASS, unit PASS, integration PASS, e2e PASS, e2e-slow PASS, sp-import PASS, pk-import PASS, trpc:parity PASS, types:check-sot PASS.
