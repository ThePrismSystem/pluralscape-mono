---
# infra-vvxm
title: "Tooling updates: commitlint, renovate, knip, pnpm audit, t3-env"
status: completed
type: task
priority: normal
created_at: 2026-03-20T12:52:36Z
updated_at: 2026-03-20T13:17:56Z
---

Add commitlint, replace dependabot with renovate, add knip for dead code detection, add pnpm audit to CI, add t3-env for API env validation

## Summary of Changes

- **commitlint**: Installed @commitlint/cli + config-conventional, created commitlint.config.js and .husky/commit-msg hook, added commitlint script
- **Renovate**: Replaced .github/dependabot.yml with renovate.json (automerge patches, group dev deps, pin GH Actions digests)
- **pnpm audit in CI**: Bumped pnpm.overrides for flatted (>=3.4.2) and fast-xml-parser (>=5.5.7) to reach clean baseline, added security job to ci.yml
- **t3-env**: Created apps/api/src/env.ts with Zod schemas for all API env vars, migrated start() and logger to use validated env, kept process.env reads in middleware (tests mock per-test)
- **knip**: Installed knip, created workspace-aware knip.json, deleted 7 orphaned files (unused constants, pubsub.ts, device-transfer-cleanup.ts), removed unused DEFAULT_PORT export then re-added as a constant for env.ts. Runs with --exclude exports --exclude types (pre-production project has many planned-but-unconsumed public API exports)
