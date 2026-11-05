---
# infra-a8uq
title: Typecheck and lint the whole repo in CI
status: completed
type: task
priority: normal
created_at: 2026-11-05T20:34:20Z
updated_at: 2026-11-05T21:59:54Z
---

CI did not cover the whole repo. `pnpm typecheck` skipped `scripts/` and other TypeScript files outside package projects. `pnpm lint` skipped `scripts/`, root and tool configs, and four packages with no lint script, and rules scoped with repo-relative globs matched nothing in packages that have their own ESLint config.

## Summary of Changes

- A root `tsconfig.json` replaces `scripts/tsconfig.json` and covers root files, `scripts/`, and `types/`. `typecheck:root` and `lint:root` run as uncached turbo root tasks, so the CI Typecheck and Lint jobs include them. `apps/api`, `packages/api-client`, `packages/import-sp`, and `packages/db` now include their scripts and config files.
- `apps/api-e2e`, `apps/mobile-web-e2e`, `packages/data`, and `tooling/test-utils` gain lint scripts. The shared ESLint config drops its ignores for scripts and test and tool configs, and treats `.mjs` like other plain JavaScript. `tokens/build.mjs` in the design system is now linted.
- Repo-relative ESLint rule blocks set `basePath` to the repo root, so they apply in every package. `no-pr-or-bean-refs-in-code` now runs repo-wide, and its bean pattern no longer matches words such as `api-keys`.
- Service-local `XResult` copies are deleted in favor of `@pluralscape/types`, as the domain type rule requires. Six result types moved into the types package.
- API responses change to match the canonical types: `TimerConfig` adds `nextCheckInAt`, `FriendConnection` adds `archived` and `archivedAt`, and `CheckInRecord` drops the undocumented `status`. `SystemSettings.pinHash` is now `ServerInternal`, so it is absent from result and wire types.
- All findings from the wider coverage are fixed in code, with no rule disabled or lowered. Remaining unlinted files are generated output.
