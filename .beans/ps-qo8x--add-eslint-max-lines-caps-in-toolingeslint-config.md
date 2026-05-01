---
# ps-qo8x
title: Add ESLint max-lines caps in tooling/eslint-config
status: completed
type: task
priority: normal
created_at: 2026-04-30T21:22:13Z
updated_at: 2026-04-30T23:15:47Z
parent: ps-r5p7
---

## Summary of Changes

Added 21 max-lines blocks to tooling/eslint-config/index.js covering 100% of source/test files.
Removed redundant max-lines block from apps/api/eslint.config.js (kept no-params-unknown).
Added eslint.loc.config.js at monorepo root: a lightweight TS-parser-only config enabling
root-level LOC ceiling enforcement via pnpm lint:loc. The root-relative globs in the shared
config require a root-level ESLint run to resolve correctly (per-package turbo runs resolve
globs relative to each package dir, so root-relative paths like apps/api/src/routes/\*\* don't match).
Added lint:loc to package.json scripts, .husky/pre-push, and .github/workflows/ci.yml.
Counting algorithm: ESLint default (counts all lines, matches wc -l).
